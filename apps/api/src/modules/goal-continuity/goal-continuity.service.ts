import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Action, Evidence, GoalAiInsight, ProgressEntry, Reflection } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestContext } from '../../common/context/request-context';
import { AiOrchestrationService } from '../ai-orchestration/ai-orchestration.service';
import type {
  GoalAiAnalysisOutput,
  ProgressCheckinOutput,
  ReflectionPromptOutput,
} from '../ai-orchestration/prompt-templates';
import { toQualitativeIndicator, type QualitativeIndicator } from '../../common/utils/score-label';
import type { CreateActionDto } from './dto/create-action.dto';
import type { UpdateActionStatusDto } from './dto/update-action-status.dto';
import type { CreateEvidenceDto } from './dto/create-evidence.dto';
import type { CreateProgressEntryDto } from './dto/create-progress-entry.dto';
import type { CreateReflectionDto } from './dto/create-reflection.dto';
import type { AiInsightReaction } from './dto/react-to-ai-insight.dto';

interface GoalOrCheckpointRef {
  employeeId: string;
  title: string;
}

export type PublicGoalAiInsight = Omit<GoalAiInsight, 'confidenceScoreInternal'> & {
  confidenceIndicator: QualitativeIndicator | null;
};

/**
 * common/utils/score-label.ts の指標変換ルール（内部スコアを生の数値のままAPIレスポンスに
 * 含めない）を GoalAiInsight にも適用する。self-analysis.service.ts の toPublicInsight() /
 * why.service.ts の toPublicWhyRecord() と同一パターン。
 */
function toPublicGoalAiInsight(insight: GoalAiInsight): PublicGoalAiInsight {
  const { confidenceScoreInternal, ...rest } = insight;
  return { ...rest, confidenceIndicator: toQualitativeIndicator(confidenceScoreInternal) };
}

/**
 * <goal_management>「行動」「成果物」「進捗」「振り返り」＋<continuous_ai>「進捗確認」
 * 「振り返り」「課題発見」「目標修正候補」「次アクション」の実装本体。
 * 「次の目標」はGoalsService.generateCandidates()を再利用する（prompt-templates.ts参照）。
 */
@Injectable()
export class GoalContinuityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiOrchestrationService,
  ) {}

  private async assertOwnsSubject(
    longTermGoalId: string | undefined,
    checkpointId: string | undefined,
    ctx: RequestContext,
  ): Promise<GoalOrCheckpointRef> {
    if (checkpointId) {
      const cp = await this.prisma.withRlsContext(ctx, (tx) => tx.checkpoint.findUnique({ where: { id: checkpointId } }));
      if (!cp || cp.employeeId !== ctx.employeeId) {
        throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '通過点が見つかりません' } });
      }
      return cp;
    }
    if (longTermGoalId) {
      const g = await this.prisma.withRlsContext(ctx, (tx) => tx.longTermGoal.findUnique({ where: { id: longTermGoalId } }));
      if (!g || g.employeeId !== ctx.employeeId) {
        throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '長期目標が見つかりません' } });
      }
      return g;
    }
    throw new BadRequestException({
      error: { code: 'VALIDATION_ERROR', message: 'longTermGoalIdまたはcheckpointIdのいずれかが必要です' },
    });
  }

  // ---------------------------------------------------------------------
  // Action / Evidence
  // ---------------------------------------------------------------------

  async createAction(dto: CreateActionDto, ctx: RequestContext): Promise<Action> {
    await this.assertOwnsSubject(dto.longTermGoalId, dto.checkpointId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.action.create({
        data: {
          employeeId: ctx.employeeId,
          checkpointId: dto.checkpointId,
          longTermGoalId: dto.longTermGoalId,
          title: dto.title,
          description: dto.description,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          source: 'user_stated',
          userApproved: true,
          status: 'not_started',
        },
      }),
    );
  }

  async listActions(
    params: { longTermGoalId?: string; checkpointId?: string },
    ctx: RequestContext,
  ): Promise<Action[]> {
    await this.assertOwnsSubject(params.longTermGoalId, params.checkpointId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.action.findMany({
        where: { employeeId: ctx.employeeId, longTermGoalId: params.longTermGoalId, checkpointId: params.checkpointId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  private async getOwnAction(id: string, ctx: RequestContext): Promise<Action> {
    const a = await this.prisma.withRlsContext(ctx, (tx) => tx.action.findUnique({ where: { id } }));
    if (!a || a.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '行動が見つかりません' } });
    }
    return a;
  }

  async updateActionStatus(id: string, dto: UpdateActionStatusDto, ctx: RequestContext): Promise<Action> {
    await this.getOwnAction(id, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.action.update({
        where: { id },
        data: { status: dto.status, completedAt: dto.status === 'done' ? new Date() : null },
      }),
    );
  }

  async createEvidence(actionId: string, dto: CreateEvidenceDto, ctx: RequestContext): Promise<Evidence> {
    await this.getOwnAction(actionId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.evidence.create({
        data: {
          employeeId: ctx.employeeId,
          actionId,
          title: dto.title,
          description: dto.description,
          url: dto.url,
        },
      }),
    );
  }

  async listEvidence(actionId: string, ctx: RequestContext): Promise<Evidence[]> {
    await this.getOwnAction(actionId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.evidence.findMany({ where: { actionId }, orderBy: { submittedAt: 'desc' } }),
    );
  }

  // ---------------------------------------------------------------------
  // ProgressEntry（<continuous_ai>「進捗確認」）
  // ---------------------------------------------------------------------

  /** 進捗確認の問いを取得する（ephemeral、DBへの保存は行わない）。 */
  async getProgressCheckinQuestion(
    params: { longTermGoalId?: string; checkpointId?: string },
    ctx: RequestContext,
  ): Promise<ProgressCheckinOutput> {
    const subject = await this.assertOwnsSubject(params.longTermGoalId, params.checkpointId, ctx);
    const recent = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.progressEntry.findMany({
        where: { employeeId: ctx.employeeId, longTermGoalId: params.longTermGoalId, checkpointId: params.checkpointId },
        orderBy: { recordedAt: 'desc' },
        take: 3,
      }),
    );
    let daysUntilDue: number | undefined;
    if (params.longTermGoalId) {
      const g = await this.prisma.withRlsContext(ctx, (tx) => tx.longTermGoal.findUnique({ where: { id: params.longTermGoalId } }));
      if (g?.targetDate) daysUntilDue = Math.ceil((g.targetDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    }
    const { data } = await this.ai.callAgent<ProgressCheckinOutput>({
      templateId: 'goal.progress-checkin-question.v1',
      employeeId: ctx.employeeId,
      context: {
        goalTitle: subject.title,
        checkpointTitle: params.checkpointId ? subject.title : undefined,
        recentProgressNotes: recent.map((r) => r.statusNote),
        daysUntilDue,
      },
    });
    return data;
  }

  async createProgressEntry(dto: CreateProgressEntryDto, ctx: RequestContext): Promise<ProgressEntry> {
    await this.assertOwnsSubject(dto.longTermGoalId, dto.checkpointId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.progressEntry.create({
        data: {
          employeeId: ctx.employeeId,
          longTermGoalId: dto.longTermGoalId,
          checkpointId: dto.checkpointId,
          percentComplete: dto.percentComplete,
          statusNote: dto.statusNote,
        },
      }),
    );
  }

  async listProgress(
    params: { longTermGoalId?: string; checkpointId?: string },
    ctx: RequestContext,
  ): Promise<ProgressEntry[]> {
    await this.assertOwnsSubject(params.longTermGoalId, params.checkpointId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.progressEntry.findMany({
        where: { employeeId: ctx.employeeId, longTermGoalId: params.longTermGoalId, checkpointId: params.checkpointId },
        orderBy: { recordedAt: 'desc' },
      }),
    );
  }

  // ---------------------------------------------------------------------
  // Reflection（<continuous_ai>「振り返り」）
  // ---------------------------------------------------------------------

  async getReflectionPrompt(
    params: { longTermGoalId?: string; checkpointId?: string },
    ctx: RequestContext,
  ): Promise<ReflectionPromptOutput> {
    const subject = await this.assertOwnsSubject(params.longTermGoalId, params.checkpointId, ctx);
    const recent = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.progressEntry.findMany({
        where: { employeeId: ctx.employeeId, longTermGoalId: params.longTermGoalId, checkpointId: params.checkpointId },
        orderBy: { recordedAt: 'desc' },
        take: 5,
      }),
    );
    const { data } = await this.ai.callAgent<ReflectionPromptOutput>({
      templateId: 'goal.reflection-prompt.v1',
      employeeId: ctx.employeeId,
      context: {
        goalTitle: subject.title,
        checkpointTitle: params.checkpointId ? subject.title : undefined,
        progressSummary: recent.length > 0 ? recent.map((r) => r.statusNote).join(' / ') : '記録なし',
      },
    });
    return data;
  }

  async createReflection(dto: CreateReflectionDto, ctx: RequestContext): Promise<Reflection> {
    await this.assertOwnsSubject(dto.longTermGoalId, dto.checkpointId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.reflection.create({
        data: {
          employeeId: ctx.employeeId,
          longTermGoalId: dto.longTermGoalId,
          checkpointId: dto.checkpointId,
          prompt: dto.prompt,
          content: dto.content,
        },
      }),
    );
  }

  async listReflections(
    params: { longTermGoalId?: string; checkpointId?: string },
    ctx: RequestContext,
  ): Promise<Reflection[]> {
    await this.assertOwnsSubject(params.longTermGoalId, params.checkpointId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.reflection.findMany({
        where: { employeeId: ctx.employeeId, longTermGoalId: params.longTermGoalId, checkpointId: params.checkpointId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  // ---------------------------------------------------------------------
  // GoalAiInsight（<continuous_ai>「課題発見」「目標修正候補」「次アクション」）
  // ---------------------------------------------------------------------

  async runAiAnalysis(longTermGoalId: string, ctx: RequestContext): Promise<PublicGoalAiInsight[]> {
    const goal = await this.prisma.withRlsContext(ctx, (tx) => tx.longTermGoal.findUnique({ where: { id: longTermGoalId } }));
    if (!goal || goal.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '長期目標が見つかりません' } });
    }

    const [recentProgress, recentReflections, incompleteActions, whyRecords] = await this.prisma.withRlsContext(
      ctx,
      (tx) =>
        Promise.all([
          tx.progressEntry.findMany({ where: { longTermGoalId }, orderBy: { recordedAt: 'desc' }, take: 5 }),
          tx.reflection.findMany({ where: { longTermGoalId }, orderBy: { createdAt: 'desc' }, take: 3 }),
          tx.action.findMany({ where: { longTermGoalId, status: { not: 'done' } }, take: 10 }),
          tx.whyRecord.findMany({
            where: { employeeId: ctx.employeeId, subjectType: 'long_term_goal', subjectId: longTermGoalId },
            orderBy: { depthLevel: 'desc' },
            take: 1,
          }),
        ]),
    );

    const { data } = await this.ai.callAgent<GoalAiAnalysisOutput>({
      templateId: 'goal.ai-analysis.v1',
      employeeId: ctx.employeeId,
      context: {
        goalTitle: goal.title,
        goalDescription: goal.description ?? undefined,
        targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : undefined,
        whyText: whyRecords[0]?.userText ?? undefined,
        recentProgressNotes: recentProgress.map((p) => p.statusNote),
        recentReflections: recentReflections.map((r) => r.content),
        incompleteActionTitles: incompleteActions.map((a) => a.title),
      },
    });

    const rows: { kind: 'issue_detected' | 'revision_candidate' | 'next_action_suggestion'; contentText: string; basedOn: object; confidenceScore: number }[] = [
      ...data.issues.map((i) => ({
        kind: 'issue_detected' as const,
        contentText: i.text,
        basedOn: {},
        confidenceScore: i.confidenceScore,
      })),
      ...data.revisionCandidates.map((r) => ({
        kind: 'revision_candidate' as const,
        contentText: r.text,
        basedOn: { proposedTitle: r.proposedTitle, proposedTargetDate: r.proposedTargetDate },
        confidenceScore: r.confidenceScore,
      })),
      ...data.nextActions.map((n) => ({
        kind: 'next_action_suggestion' as const,
        contentText: `${n.title}: ${n.description}`,
        basedOn: { title: n.title, description: n.description },
        confidenceScore: n.confidenceScore,
      })),
    ];

    if (rows.length === 0) return [];

    const created = await this.prisma.withRlsContext(ctx, (tx) =>
      Promise.all(
        rows.map((r) =>
          tx.goalAiInsight.create({
            data: {
              employeeId: ctx.employeeId,
              longTermGoalId,
              kind: r.kind,
              contentText: r.contentText,
              basedOn: r.basedOn as object,
              confidenceScoreInternal: r.confidenceScore,
              status: 'exploring',
              userApproved: false,
            },
          }),
        ),
      ),
    );
    return created.map(toPublicGoalAiInsight);
  }

  async listAiInsights(longTermGoalId: string, ctx: RequestContext): Promise<PublicGoalAiInsight[]> {
    const insights = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.goalAiInsight.findMany({ where: { employeeId: ctx.employeeId, longTermGoalId }, orderBy: { createdAt: 'desc' } }),
    );
    return insights.map(toPublicGoalAiInsight);
  }

  private async getOwnInsight(id: string, ctx: RequestContext): Promise<GoalAiInsight> {
    const insight = await this.prisma.withRlsContext(ctx, (tx) => tx.goalAiInsight.findUnique({ where: { id } }));
    if (!insight || insight.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'AI分析結果が見つかりません' } });
    }
    return insight;
  }

  /**
   * <ai_principles>「AIの提案と人間の確定を混同しない」の実装。acceptされた場合のみ、
   * 種類に応じて実際のデータ（Action作成、LongTermGoal修正）を反映する。
   */
  async reactToAiInsight(id: string, reaction: AiInsightReaction, ctx: RequestContext): Promise<PublicGoalAiInsight> {
    const insight = await this.getOwnInsight(id, ctx);

    if (reaction === 'accept') {
      const basedOn = insight.basedOn as Record<string, unknown>;
      if (insight.kind === 'next_action_suggestion') {
        await this.prisma.withRlsContext(ctx, (tx) =>
          tx.action.create({
            data: {
              employeeId: ctx.employeeId,
              longTermGoalId: insight.longTermGoalId,
              title: typeof basedOn.title === 'string' ? basedOn.title : insight.contentText,
              description: typeof basedOn.description === 'string' ? basedOn.description : undefined,
              source: 'ai_inferred',
              userApproved: true,
              status: 'not_started',
            },
          }),
        );
      } else if (insight.kind === 'revision_candidate') {
        const before = await this.prisma.withRlsContext(ctx, (tx) =>
          tx.longTermGoal.findUnique({ where: { id: insight.longTermGoalId } }),
        );
        await this.prisma.withRlsContext(ctx, (tx) =>
          tx.longTermGoal.update({
            where: { id: insight.longTermGoalId },
            data: {
              title: typeof basedOn.proposedTitle === 'string' ? basedOn.proposedTitle : undefined,
              targetDate:
                typeof basedOn.proposedTargetDate === 'string' ? new Date(basedOn.proposedTargetDate) : undefined,
            },
          }),
        );
        await this.prisma.withRlsContext(ctx, (tx) =>
          tx.goalChangeLog.create({
            data: {
              employeeId: ctx.employeeId,
              subjectType: 'long_term_goal',
              subjectId: insight.longTermGoalId,
              action: 'updated',
              beforeValue: before ? { title: before.title, targetDate: before.targetDate } : undefined,
              afterValue: basedOn as object,
              reason: 'AI修正候補の採用',
            },
          }),
        );
      }
      // issue_detectedは情報提供のみ。acceptは「確認した」という意味に留まる。
    }

    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.goalAiInsight.update({
        where: { id },
        data: {
          userApproved: reaction === 'accept',
          status: reaction === 'accept' ? 'confirmed' : 'discontinued',
          reviewedAt: new Date(),
        },
      }),
    );
    return toPublicGoalAiInsight(updated);
  }
}
