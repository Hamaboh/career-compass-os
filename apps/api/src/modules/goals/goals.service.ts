import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Checkpoint, Direction, GoalCandidate, GoalChangeLog, LongTermGoal } from '@prisma/client';
import type { GoalChangeAction, GoalChangeSubjectType } from '@career-compass/shared';
import { isSmartAuditPassing } from '@career-compass/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestContext } from '../../common/context/request-context';
import { AiOrchestrationService } from '../ai-orchestration/ai-orchestration.service';
import type {
  GoalCandidateGenerateOutput,
  SmartAuditOutput,
  SmartGuidanceOutput,
} from '../ai-orchestration/prompt-templates';
import { WhyService } from '../self-understanding/why/why.service';
import { RemindersService } from '../reminders/reminders.service';
import type { CreateDirectionDto } from './dto/create-direction.dto';
import type { CreateLongTermGoalDto } from './dto/create-long-term-goal.dto';
import type { UpdateLongTermGoalDto } from './dto/update-long-term-goal.dto';
import type { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import type { GenerateGoalCandidatesDto } from './dto/generate-goal-candidates.dto';
import type { SmartGuidanceQuestionDto } from './dto/smart-guidance-question.dto';
import type { ConfirmLongTermGoalDto } from './dto/confirm-long-term-goal.dto';

interface GoalCandidateBasis {
  subjectType: 'direction' | 'vision';
  subjectId: string;
  relatedInstitutionId: string | null;
}

/**
 * Phase2 §4想定「目標階層モデル」＋<implementation_scope> 10〜11・14〜15番の実装本体。
 * Direction/LongTermGoal/Checkpointの本人管理と、GoalCandidateの生成・確定を扱う。
 * Action/Evidence/Reflection（進捗系）はこのStepのスコープ外（modules/READMEのStep 1想定分、
 * design freezeルール4に基づき要件を勝手に拡張しない）。
 */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiOrchestrationService,
    private readonly why: WhyService,
    private readonly reminders: RemindersService,
  ) {}

  /** <goal_management>「目標変更履歴」の実装本体。Direction/LongTermGoal/Checkpointの変更を記録する。 */
  private async recordChangeLog(
    subjectType: GoalChangeSubjectType,
    subjectId: string,
    action: GoalChangeAction,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    ctx: RequestContext,
    reason?: string,
  ): Promise<void> {
    await this.prisma.withRlsContext(ctx, (tx) =>
      tx.goalChangeLog.create({
        data: {
          employeeId: ctx.employeeId,
          subjectType,
          subjectId,
          action,
          beforeValue: before as unknown as object | undefined,
          afterValue: after as unknown as object | undefined,
          reason,
        },
      }),
    );
  }

  async listChangeLogs(
    subjectType: GoalChangeSubjectType,
    subjectId: string,
    ctx: RequestContext,
  ): Promise<GoalChangeLog[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.goalChangeLog.findMany({
        where: { employeeId: ctx.employeeId, subjectType, subjectId },
        orderBy: { changedAt: 'desc' },
      }),
    );
  }

  // ---------------------------------------------------------------------
  // Direction
  // ---------------------------------------------------------------------

  async createDirection(dto: CreateDirectionDto, ctx: RequestContext): Promise<Direction> {
    const vision = await this.prisma.withRlsContext(ctx, (tx) => tx.vision.findUnique({ where: { id: dto.visionId } }));
    if (!vision || vision.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Visionが見つかりません' } });
    }
    const direction = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.direction.create({
        data: {
          employeeId: ctx.employeeId,
          visionId: dto.visionId,
          content: dto.content,
          source: 'user_stated',
          userApproved: true,
          status: 'confirmed',
        },
      }),
    );
    await this.recordChangeLog('direction', direction.id, 'created', null, { content: direction.content }, ctx);
    return direction;
  }

  async listDirections(ctx: RequestContext): Promise<Direction[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.direction.findMany({ where: { employeeId: ctx.employeeId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async getDirection(id: string, ctx: RequestContext): Promise<Direction> {
    const d = await this.prisma.withRlsContext(ctx, (tx) => tx.direction.findUnique({ where: { id } }));
    if (!d || d.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Directionが見つかりません' } });
    }
    return d;
  }

  // ---------------------------------------------------------------------
  // LongTermGoal
  // ---------------------------------------------------------------------

  async createLongTermGoal(dto: CreateLongTermGoalDto, ctx: RequestContext): Promise<LongTermGoal> {
    if (dto.directionId) {
      await this.getDirection(dto.directionId, ctx);
    }
    const goal = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.longTermGoal.create({
        data: {
          employeeId: ctx.employeeId,
          directionId: dto.directionId,
          title: dto.title,
          description: dto.description,
          targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
          source: 'user_stated',
          userApproved: true,
          status: 'provisional',
        },
      }),
    );
    await this.recordChangeLog(
      'long_term_goal',
      goal.id,
      'created',
      null,
      { title: goal.title, targetDate: goal.targetDate },
      ctx,
    );
    return goal;
  }

  /**
   * <smart_guidance>要件。目標作成中に、SMARTの観点で最も曖昧な部分を埋める質問を取得する。
   * まだ何も保存されていない下書き段階で呼び出す想定のため、DBへの書き込みは行わない。
   */
  async getSmartGuidanceQuestion(dto: SmartGuidanceQuestionDto, ctx: RequestContext): Promise<SmartGuidanceOutput> {
    const { data } = await this.ai.callAgent<SmartGuidanceOutput>({
      templateId: 'smart.guidance-question.v1',
      employeeId: ctx.employeeId,
      context: {
        draftTitle: dto.draftTitle,
        draftDescription: dto.draftDescription,
        draftTargetDate: dto.draftTargetDate,
      },
    });
    return data;
  }

  /**
   * employeeIdを省略した場合は本人の目標一覧（既存の挙動を変えない）。
   * UL/ADMINがemployeeIdを明示した場合は、その社員の目標一覧を返す
   * （実際に見えるかどうかはlong_term_goals_ul_select_unit_scope RLSポリシーが強制する。
   * 自Unit外のemployeeIdを指定した場合は0件になる、追加のアプリ層チェックは不要）。
   * 2026-08-15、UL-03(メンバー詳細画面)実装時に発見・解消: 従来はemployeeId固定でSELF専用に
   * なっており、Phase3が付与しているUL閲覧権限をアプリ層が不必要に狭めていた
   * （前回完了報告で「報告のみ・修正せず」としていた既知の非対称性の解消）。
   */
  async listLongTermGoals(ctx: RequestContext, employeeId?: string): Promise<LongTermGoal[]> {
    const targetEmployeeId = employeeId && (ctx.role === 'UL' || ctx.role === 'ADMIN') ? employeeId : ctx.employeeId;
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.longTermGoal.findMany({ where: { employeeId: targetEmployeeId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async getLongTermGoal(id: string, ctx: RequestContext): Promise<LongTermGoal> {
    const g = await this.prisma.withRlsContext(ctx, (tx) => tx.longTermGoal.findUnique({ where: { id } }));
    if (!g || g.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '長期目標が見つかりません' } });
    }
    return g;
  }

  async updateLongTermGoal(id: string, dto: UpdateLongTermGoalDto, ctx: RequestContext): Promise<LongTermGoal> {
    const before = await this.getLongTermGoal(id, ctx);
    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.longTermGoal.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
          // 内容が変わったら、それまでのSMART監査結果は無効化する（古い監査で確定させないため）。
          smartSpecific: null,
          smartMeasurable: null,
          smartAchievable: null,
          smartRelevant: null,
          smartTimebound: null,
          smartAuditedAt: null,
          smartOverrideReason: null,
        },
      }),
    );
    await this.recordChangeLog(
      'long_term_goal',
      id,
      'updated',
      { title: before.title, description: before.description, targetDate: before.targetDate },
      { title: updated.title, description: updated.description, targetDate: updated.targetDate },
      ctx,
    );
    return updated;
  }

  /**
   * <smart_gate>要件。目標保存直前のSMART監査を実行し、結果をLongTermGoalに保存する。
   * 監査そのものはAIが行うが、5項目の判定を最終的に確定として扱うかどうかは、
   * このあとのconfirmLongTermGoal()での本人の確定操作（またはoverrideReason）による
   * （<ai_principles>「AIの提案と人間の確定を混同しない」の実装）。
   */
  async runSmartAudit(id: string, ctx: RequestContext): Promise<LongTermGoal> {
    const goal = await this.getLongTermGoal(id, ctx);
    const direction = goal.directionId ? await this.getDirection(goal.directionId, ctx) : null;
    const whyRecords = await this.why.listForSubject('long_term_goal', id, ctx);
    const whyText = whyRecords.at(-1)?.userText ?? undefined;

    const { data } = await this.ai.callAgent<SmartAuditOutput>({
      templateId: 'smart.audit.v1',
      employeeId: ctx.employeeId,
      context: {
        title: goal.title,
        description: goal.description ?? undefined,
        targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : undefined,
        whyText,
        directionText: direction?.content,
      },
    });

    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.longTermGoal.update({
        where: { id },
        data: {
          smartSpecific: data.specific,
          smartMeasurable: data.measurable,
          smartAchievable: data.achievable,
          smartRelevant: data.relevant,
          smartTimebound: data.timebound,
          smartAuditedAt: new Date(),
        },
      }),
    );
    await this.recordChangeLog(
      'long_term_goal',
      id,
      'smart_audited',
      null,
      {
        specific: data.specific,
        measurable: data.measurable,
        achievable: data.achievable,
        relevant: data.relevant,
        timebound: data.timebound,
        auditNote: data.auditNote,
        followUpQuestions: data.followUpQuestions,
      },
      ctx,
    );
    return updated;
  }

  /**
   * <why>要件・<smart_gate>要件の「確定前ゲート」の実装本体。目標を確定させる前に、
   * (1) 対象のWhyRecordが十分な確信度に達しているか、(2) SMART監査が実行済みで、
   * 全項目okかsmartOverrideReasonが提示されているか、を両方とも機械的に検査する。
   */
  async confirmLongTermGoal(id: string, dto: ConfirmLongTermGoalDto, ctx: RequestContext): Promise<LongTermGoal> {
    const goal = await this.getLongTermGoal(id, ctx);
    if (goal.status === 'confirmed') return goal;

    const convincing = await this.why.isConvincing('long_term_goal', id, ctx);
    if (!convincing) {
      throw new BadRequestException({
        error: {
          code: 'WHY_NOT_CONVINCING',
          message: 'この目標を確定する前に、なぜその目標を目指すのか(Why)を十分に深掘りしてください。',
        },
      });
    }

    if (!goal.smartAuditedAt) {
      throw new BadRequestException({
        error: { code: 'SMART_AUDIT_REQUIRED', message: '確定する前にSMART監査を実行してください。' },
      });
    }
    const smartPassing = isSmartAuditPassing({
      specific: goal.smartSpecific ?? undefined,
      measurable: goal.smartMeasurable ?? undefined,
      achievable: goal.smartAchievable ?? undefined,
      relevant: goal.smartRelevant ?? undefined,
      timebound: goal.smartTimebound ?? undefined,
    });
    if (!smartPassing && !dto.smartOverrideReason?.trim()) {
      throw new BadRequestException({
        error: {
          code: 'SMART_AUDIT_INSUFFICIENT',
          message: 'SMART監査が不足しています。このまま確定する場合は合理的な理由を入力してください。',
        },
      });
    }

    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.longTermGoal.update({
        where: { id },
        data: {
          status: 'confirmed',
          smartOverrideReason: !smartPassing ? dto.smartOverrideReason : goal.smartOverrideReason,
        },
      }),
    );
    await this.recordChangeLog(
      'long_term_goal',
      id,
      'confirmed',
      { status: goal.status },
      { status: 'confirmed', smartOverrideReason: updated.smartOverrideReason },
      ctx,
    );
    // <reminder>要件: ULが手動で管理しなくてよいよう、確定と同時に検証タイミングを自動生成する。
    await this.reminders.autoScheduleForGoal(updated, ctx);
    return updated;
  }

  // ---------------------------------------------------------------------
  // Checkpoint
  // ---------------------------------------------------------------------

  async createCheckpoint(dto: CreateCheckpointDto, ctx: RequestContext): Promise<Checkpoint> {
    await this.getLongTermGoal(dto.longTermGoalId, ctx);
    const checkpoint = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.checkpoint.create({
        data: {
          employeeId: ctx.employeeId,
          longTermGoalId: dto.longTermGoalId,
          title: dto.title,
          description: dto.description,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          source: 'user_stated',
          userApproved: true,
          status: 'provisional',
        },
      }),
    );
    await this.recordChangeLog(
      'checkpoint',
      checkpoint.id,
      'created',
      null,
      { title: checkpoint.title, dueDate: checkpoint.dueDate },
      ctx,
    );
    return checkpoint;
  }

  async listCheckpoints(longTermGoalId: string, ctx: RequestContext): Promise<Checkpoint[]> {
    await this.getLongTermGoal(longTermGoalId, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.checkpoint.findMany({ where: { longTermGoalId }, orderBy: { createdAt: 'asc' } }),
    );
  }

  private async getOwnCheckpoint(id: string, ctx: RequestContext): Promise<Checkpoint> {
    const cp = await this.prisma.withRlsContext(ctx, (tx) => tx.checkpoint.findUnique({ where: { id } }));
    if (!cp || cp.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '通過点が見つかりません' } });
    }
    return cp;
  }

  /**
   * Checkpointは目標を細分化した通過点であり、親LongTermGoal確定時点で既にWhyの検査が
   * 済んでいる前提のため、個々のCheckpoint確定では独立したWhyゲートを課さない
   * （粒度が細かい通過点ごとに毎回Whyを深掘りさせるのは過剰と判断した設計判断、
   * design freezeルール1の軽微な実装判断として完了報告に明記する）。
   */
  async confirmCheckpoint(id: string, ctx: RequestContext): Promise<Checkpoint> {
    const before = await this.getOwnCheckpoint(id, ctx);
    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.checkpoint.update({ where: { id }, data: { status: 'confirmed' } }),
    );
    await this.recordChangeLog('checkpoint', id, 'confirmed', { status: before.status }, { status: 'confirmed' }, ctx);
    // <reminder>要件: Checkpointにも期限があれば同様に検証タイミングを自動生成する。
    await this.reminders.autoScheduleForGoal(
      { id: updated.id, employeeId: updated.employeeId, targetDate: updated.dueDate, kind: 'checkpoint' },
      ctx,
    );
    return updated;
  }

  /**
   * <goal_management>「目標期限」のライフサイクル完了操作。達成済みにマークし、
   * <continuous_ai>「次の目標」の検討を始められる状態にする（実際の候補生成は
   * generateCandidates()にachievedGoalIdを渡して呼び出す、別の明示的操作）。
   */
  async achieveLongTermGoal(id: string, ctx: RequestContext): Promise<LongTermGoal> {
    const goal = await this.getLongTermGoal(id, ctx);
    if (goal.status === 'achieved') return goal;
    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.longTermGoal.update({ where: { id }, data: { status: 'achieved' } }),
    );
    await this.recordChangeLog(
      'long_term_goal',
      id,
      'status_changed',
      { status: goal.status },
      { status: 'achieved' },
      ctx,
    );
    return updated;
  }

  /**
   * Phase4 7.5節「目標を意図的にやめる操作」(23.1 R3で新設されたMVPブロッカー対応)。
   * 削除ではなく状態遷移(discontinued)であることをデータ構造でも明示する
   * （Phase2 FOUNDATION §0.2の9値語彙、目標階層は論理削除を使わない設計方針どおり）。
   * 2026-08-15、フロントエンド実装時に本エンドポイントが未実装であることが判明し追加した
   * （design freezeルール3: 要件と実装の齟齬を発見時点で報告し、指示を受けて解消）。
   */
  async discontinueLongTermGoal(id: string, reason: string | undefined, ctx: RequestContext): Promise<LongTermGoal> {
    const goal = await this.getLongTermGoal(id, ctx);
    if (goal.status === 'discontinued' || goal.status === 'archived') return goal;
    const updated = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.longTermGoal.update({ where: { id }, data: { status: 'discontinued' } }),
    );
    await this.recordChangeLog(
      'long_term_goal',
      id,
      'status_changed',
      { status: goal.status },
      { status: 'discontinued', reason },
      ctx,
    );
    return updated;
  }

  // ---------------------------------------------------------------------
  // GoalCandidate（<implementation_scope> 14〜15番）
  // ---------------------------------------------------------------------

  async generateCandidates(dto: GenerateGoalCandidatesDto, ctx: RequestContext): Promise<GoalCandidate[]> {
    let directionOrVisionText: string;
    let whySubjectType: 'direction' | 'vision';
    let whySubjectId: string;
    let achievedGoalContext: string | undefined;

    if (dto.achievedGoalId) {
      const achieved = await this.getLongTermGoal(dto.achievedGoalId, ctx);
      achievedGoalContext = achieved.title;
    }

    if (dto.directionId) {
      const direction = await this.getDirection(dto.directionId, ctx);
      directionOrVisionText = direction.content;
      whySubjectType = 'direction';
      whySubjectId = direction.id;
    } else if (dto.visionId) {
      const vision = await this.prisma.withRlsContext(ctx, (tx) => tx.vision.findUnique({ where: { id: dto.visionId } }));
      if (!vision || vision.employeeId !== ctx.employeeId) {
        throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Visionが見つかりません' } });
      }
      directionOrVisionText = vision.content;
      whySubjectType = 'vision';
      whySubjectId = vision.id;
    } else {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'directionIdまたはvisionIdのいずれかが必要です' },
      });
    }

    const whyRecords = await this.why.listForSubject(whySubjectType, whySubjectId, ctx);
    const whyText = whyRecords.at(-1)?.userText ?? undefined;

    const insights = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.selfAnalysisInsight.findMany({
        where: { employeeId: ctx.employeeId, userApproved: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    );

    const [kpis, ulms] = await this.prisma.withRlsContext(ctx, (tx) =>
      Promise.all([
        tx.kpiMaster.findMany({ where: { status: 'active' }, take: 10 }),
        tx.ulmMaster.findMany({ where: { status: 'active' }, take: 10 }),
      ]),
    );

    const { data } = await this.ai.callAgent<GoalCandidateGenerateOutput>({
      templateId: 'goal-candidate.generate.v1',
      employeeId: ctx.employeeId,
      context: {
        directionOrVisionText,
        whyText,
        achievedGoalContext,
        relatedInsightSummaries: insights.map((i) => i.userEditText ?? i.contentText),
        institutionOptions: [
          ...kpis.map((k) => ({ id: k.id, label: k.title, kind: 'kpi' as const })),
          ...ulms.map((u) => ({ id: u.id, label: u.title, kind: 'ulm' as const })),
        ],
      },
    });

    return this.prisma.withRlsContext(ctx, (tx) =>
      Promise.all(
        data.candidates.map((c) => {
          const basedOn: GoalCandidateBasis = {
            subjectType: whySubjectType,
            subjectId: whySubjectId,
            relatedInstitutionId: c.relatedInstitutionId ?? null,
          };
          return tx.goalCandidate.create({
            data: {
              employeeId: ctx.employeeId,
              basedOn: basedOn as unknown as object,
              title: c.title,
              description: c.description,
              rationale: c.rationale,
              status: 'proposed',
            },
          });
        }),
      ),
    );
  }

  async listCandidates(ctx: RequestContext): Promise<GoalCandidate[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.goalCandidate.findMany({ where: { employeeId: ctx.employeeId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  private async getOwnCandidate(id: string, ctx: RequestContext): Promise<GoalCandidate> {
    const c = await this.prisma.withRlsContext(ctx, (tx) => tx.goalCandidate.findUnique({ where: { id } }));
    if (!c || c.employeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '目標候補が見つかりません' } });
    }
    return c;
  }

  /** <implementation_scope> 15番。AIの候補は本人が明示的にacceptして初めてLongTermGoalになる。 */
  async acceptCandidate(id: string, ctx: RequestContext): Promise<LongTermGoal> {
    const candidate = await this.getOwnCandidate(id, ctx);
    if (candidate.status !== 'proposed') {
      throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: 'この候補は既に処理済みです' } });
    }
    const basedOn = candidate.basedOn as unknown as GoalCandidateBasis | null;
    const directionId = basedOn?.subjectType === 'direction' ? basedOn.subjectId : undefined;

    return this.prisma.withRlsContext(ctx, async (tx) => {
      const goal = await tx.longTermGoal.create({
        data: {
          employeeId: ctx.employeeId,
          directionId,
          title: candidate.title,
          description: candidate.description,
          targetDate: candidate.suggestedTargetDate,
          source: 'ai_inferred',
          userApproved: true,
          status: 'provisional',
        },
      });
      await tx.goalCandidate.update({
        where: { id },
        data: { status: 'accepted', acceptedGoalId: goal.id, reviewedAt: new Date() },
      });
      return goal;
    });
  }

  async rejectCandidate(id: string, ctx: RequestContext): Promise<GoalCandidate> {
    const candidate = await this.getOwnCandidate(id, ctx);
    if (candidate.status !== 'proposed') {
      throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: 'この候補は既に処理済みです' } });
    }
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.goalCandidate.update({ where: { id }, data: { status: 'rejected', reviewedAt: new Date() } }),
    );
  }
}
