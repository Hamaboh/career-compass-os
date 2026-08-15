import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { OneOnOnePrepSheet, OneOnOneSession } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestContext } from '../../common/context/request-context';
import { AiOrchestrationService } from '../ai-orchestration/ai-orchestration.service';
import type { OneOnOnePrepOutput } from '../ai-orchestration/prompt-templates';
import type { CreateOneOnOneSessionDto } from './dto/create-one-on-one-session.dto';
import type { CompleteOneOnOneSessionDto } from './dto/complete-one-on-one-session.dto';

/**
 * <one_on_one>要件の実装本体。AIは1on1の最終判断をしない: OneOnOnePrepSheetは常に
 * source=ai_inferredで生成される「材料」に過ぎず、実際の1on1の内容・判断は
 * OneOnOneSession.notesにUL自身の言葉で記録される（user_stated）。
 * RLS: OneOnOnePrepSheetは対象メンバー本人には非公開（migration参照）。
 */
@Injectable()
export class OneOnOneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiOrchestrationService,
  ) {}

  /**
   * ctxのUL/ADMINが実際にmemberIdを担当しているかを、employees RLS
   * （employees_ul_select_unit_scope）を通した可視性チェックで検証する
   * （自Unit判定ロジックを重複実装しない、既存の境界をそのまま再利用する）。
   */
  private async assertVisibleMember(memberId: string, ctx: RequestContext): Promise<{ id: string; name: string }> {
    const member = await this.prisma.withRlsContext(ctx, (tx) => tx.employee.findUnique({ where: { id: memberId } }));
    if (!member) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '対象の社員が見つかりません' } });
    }
    return member;
  }

  async generatePrepSheet(memberId: string, ctx: RequestContext): Promise<OneOnOnePrepSheet> {
    const member = await this.assertVisibleMember(memberId, ctx);

    const previousSession = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.oneOnOneSession.findFirst({
        where: { employeeId: memberId, unitLeaderId: ctx.employeeId, status: 'completed' },
        orderBy: { heldAt: 'desc' },
      }),
    );

    // 1on1準備シート生成はwithSystemBypass相当の全件横断が必要だが、個人データへの
    // 越境アクセスを避けるため、あくまでmemberId本人のRLSコンテキストではなく
    // ULの通常コンテキストのまま、goal_ai_insights等の「UL閲覧可」ポリシーの範囲で取得する
    // （self_analysis系のような本人専用テーブルへは立ち入らない設計）。
    const goals = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.longTermGoal.findMany({ where: { employeeId: memberId, status: { in: ['confirmed', 'active', 'achieved'] } } }),
    );
    const goalIds = goals.map((g) => g.id);

    const [recentProgress, incompleteActions, achievedActions, issues] = await this.prisma.withRlsContext(ctx, (tx) =>
      Promise.all([
        tx.progressEntry.findMany({
          where: { employeeId: memberId, longTermGoalId: { in: goalIds } },
          orderBy: { recordedAt: 'desc' },
          take: 10,
        }),
        tx.action.findMany({
          where: { employeeId: memberId, longTermGoalId: { in: goalIds }, status: { not: 'done' } },
          take: 10,
        }),
        tx.action.findMany({
          where: { employeeId: memberId, longTermGoalId: { in: goalIds }, status: 'done' },
          orderBy: { completedAt: 'desc' },
          take: 5,
        }),
        tx.goalAiInsight.findMany({
          where: { employeeId: memberId, longTermGoalId: { in: goalIds }, kind: 'issue_detected', userApproved: true },
          take: 5,
        }),
      ]),
    );

    const { data } = await this.ai.callAgent<OneOnOnePrepOutput>({
      templateId: 'one-on-one.prep-summary.v1',
      employeeId: ctx.employeeId,
      context: {
        memberName: member.name,
        previousSessionNotes: previousSession?.notes ?? undefined,
        goalProgressFacts: [
          ...goals.map((g) => `目標「${g.title}」ステータス: ${g.status}`),
          ...recentProgress.map((p) => p.statusNote),
        ],
        changesSinceLastSession: [],
        recentIssues: issues.map((i) => i.contentText),
        incompleteActionTitles: incompleteActions.map((a) => a.title),
        recentAchievements: achievedActions.map((a) => a.title),
        fieldContextNotes: [],
      },
    });

    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.oneOnOnePrepSheet.create({
        data: {
          employeeId: memberId,
          unitLeaderId: ctx.employeeId,
          previousSessionSummary: previousSession?.notes ?? undefined,
          goalProgressSummary: data.goalProgressSummary,
          changesSummary: data.changesSummary,
          issuesSummary: data.issuesSummary,
          incompleteActionsSummary: data.incompleteActionsSummary,
          achievementsSummary: data.achievementsSummary,
          fieldContextSummary: data.fieldContextSummary,
          recommendedQuestions: data.recommendedQuestions,
          goalRevisionCandidates: data.goalRevisionCandidates,
          nextActionCandidates: data.nextActionCandidates,
        },
      }),
    );
  }

  async listPrepSheetsForMember(memberId: string, ctx: RequestContext): Promise<OneOnOnePrepSheet[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.oneOnOnePrepSheet.findMany({ where: { employeeId: memberId }, orderBy: { generatedAt: 'desc' } }),
    );
  }

  async getPrepSheet(id: string, ctx: RequestContext): Promise<OneOnOnePrepSheet> {
    const sheet = await this.prisma.withRlsContext(ctx, (tx) => tx.oneOnOnePrepSheet.findUnique({ where: { id } }));
    if (!sheet) {
      // RLSにより、本人(対象メンバー)や無関係なULからは常にnullとなる（意図的な非公開）。
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '準備シートが見つかりません' } });
    }
    return sheet;
  }

  async markPrepSheetReviewed(id: string, ctx: RequestContext): Promise<OneOnOnePrepSheet> {
    await this.getPrepSheet(id, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.oneOnOnePrepSheet.update({ where: { id }, data: { reviewedByUlAt: new Date() } }),
    );
  }

  async createSession(dto: CreateOneOnOneSessionDto, ctx: RequestContext): Promise<OneOnOneSession> {
    await this.assertVisibleMember(dto.employeeId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.oneOnOneSession.create({
        data: {
          employeeId: dto.employeeId,
          unitLeaderId: ctx.employeeId,
          prepSheetId: dto.prepSheetId,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          status: 'scheduled',
        },
      }),
    );
  }

  async listSessionsForMember(memberId: string, ctx: RequestContext): Promise<OneOnOneSession[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.oneOnOneSession.findMany({ where: { employeeId: memberId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async listMySessions(ctx: RequestContext): Promise<OneOnOneSession[]> {
    // RLSがUL(unit_leader_id=自分)とメンバー(employee_id=自分)の両方の行を合成して返す。
    return this.prisma.withRlsContext(ctx, (tx) => tx.oneOnOneSession.findMany({ orderBy: { createdAt: 'desc' } }));
  }

  private async getOwnSession(id: string, ctx: RequestContext): Promise<OneOnOneSession> {
    const session = await this.prisma.withRlsContext(ctx, (tx) => tx.oneOnOneSession.findUnique({ where: { id } }));
    if (!session) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '1on1セッションが見つかりません' } });
    }
    return session;
  }

  /** <one_on_one>「AIは最終判断をしない」の実装本体。notesはUL自身の記録（user_stated）。 */
  async completeSession(id: string, dto: CompleteOneOnOneSessionDto, ctx: RequestContext): Promise<OneOnOneSession> {
    const session = await this.getOwnSession(id, ctx);
    if (session.unitLeaderId !== ctx.employeeId) {
      // RLSのFOR ALLはunit_leader_idのみに許可されているため、通常はここに到達する前にRLSで
      // 弾かれる。本人(member)がFOR SELECTで読めてしまうケースの二重防御として明示する。
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'この1on1セッションを完了できるのは担当ULのみです' },
      });
    }
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.oneOnOneSession.update({
        where: { id },
        data: {
          notes: dto.notes,
          heldAt: dto.heldAt ? new Date(dto.heldAt) : new Date(),
          status: 'completed',
        },
      }),
    );
  }
}
