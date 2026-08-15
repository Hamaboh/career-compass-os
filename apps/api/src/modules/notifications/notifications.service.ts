import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import type { NotificationType } from '@career-compass/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestContext } from '../../common/context/request-context';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** 自己分析が停滞したとみなす無活動期間。ULが手動監視しなくてよいようアプリ側で検知する。 */
const STALLED_SELF_ANALYSIS_DAYS = 3;
/** SMART監査が未実施のまま放置されたとみなす日数。 */
const SMART_INCOMPLETE_DAYS = 3;
/** 1on1準備シートが未レビューのまま放置されたとみなす経過時間。生成直後の誤発火を避ける。 */
const PREP_SHEET_UNREVIEWED_HOURS = 1;

/**
 * <notification>要件の実装本体。Phase3 5.A `notifications`（ドメインI）を配信レイヤーとし、
 * 8種別＋「AIからの重要な提案」の計9種別を、既存のReminderSchedule/Action/GoalAiInsight/
 * OneOnOnePrepSheet/SelfAnalysisSession/LongTermGoalの状態から機械的に検知して生成する。
 *
 * 「ULが手動で全員分のリマインダーを管理する必要がない」設計にするため、通知の生成主体は
 * 常にsweepAndGenerate()（HTTPリクエストの主体を持たないバックグラウンド処理、worker.ts経由）
 * であり、UL/Adminが個々のメンバーの状態を見て回って手動で通知を送る操作は存在しない。
 *
 * 冪等性: 同じ(relatedType, relatedId, notificationType)の組についてまだ通知が存在しない場合のみ
 * 生成する（重複通知の防止）。ReminderSchedule起点の3種別のみ、status遷移(pending→due)自体が
 * 自然な重複防止になっている（既存のRemindersServiceの設計を踏襲）。
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // 本人向けAPI（閲覧・既読化）
  // ---------------------------------------------------------------------

  async listMine(ctx: RequestContext, unreadOnly: boolean): Promise<Notification[]> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.notification.findMany({
        where: { recipientEmployeeId: ctx.employeeId, ...(unreadOnly ? { readAt: null } : {}) },
        orderBy: { deliveredAt: 'desc' },
      }),
    );
  }

  private async getOwn(id: string, ctx: RequestContext): Promise<Notification> {
    const n = await this.prisma.withRlsContext(ctx, (tx) => tx.notification.findUnique({ where: { id } }));
    if (!n || n.recipientEmployeeId !== ctx.employeeId) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '通知が見つかりません' } });
    }
    return n;
  }

  async markRead(id: string, ctx: RequestContext): Promise<Notification> {
    await this.getOwn(id, ctx);
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.notification.update({ where: { id }, data: { readAt: new Date() } }),
    );
  }

  async markAllRead(ctx: RequestContext): Promise<{ count: number }> {
    return this.prisma.withRlsContext(ctx, (tx) =>
      tx.notification.updateMany({
        where: { recipientEmployeeId: ctx.employeeId, readAt: null },
        data: { readAt: new Date() },
      }),
    );
  }

  // ---------------------------------------------------------------------
  // 生成（システム専用。withSystemBypass()経由、HTTPコントローラから直接呼ばない）
  // ---------------------------------------------------------------------

  private async createIfAbsent(
    tx: Prisma.TransactionClient,
    data: {
      recipientEmployeeId: string;
      notificationType: NotificationType;
      title: string;
      body: string;
      relatedType: string;
      relatedId: string;
    },
  ): Promise<boolean> {
    const existing = await tx.notification.findFirst({
      where: {
        recipientEmployeeId: data.recipientEmployeeId,
        notificationType: data.notificationType,
        relatedType: data.relatedType,
        relatedId: data.relatedId,
      },
      select: { id: true },
    });
    if (existing) return false;
    await tx.notification.create({ data: { ...data, channel: 'in_app' } });
    return true;
  }

  /**
   * 全社員を横断してスイープし、期限到来・放置検知に基づく通知を生成する。
   * worker.tsから定期実行される（<notification>要件「頻度やタイミングはUXを阻害しないよう設計」に
   * 対応するsweep間隔はworker.ts側の呼び出し間隔で制御する）。
   */
  async sweepAndGenerate(): Promise<{ created: number }> {
    let created = 0;
    created += await this.sweepReminderSchedules();
    created += await this.sweepActionDue();
    created += await this.sweepOneOnOnePrep();
    created += await this.sweepGoalAiInsights();
    created += await this.sweepSmartIncomplete();
    created += await this.sweepStalledSelfAnalysis();
    if (created > 0) this.logger.log(`sweepAndGenerate: ${created}件の通知を生成しました`);
    return { created };
  }

  /** ReminderSchedule(interim_check/deadline/reflection)の到来分。status遷移自体が重複防止。 */
  private async sweepReminderSchedules(): Promise<number> {
    return this.prisma.withSystemBypass(async (tx) => {
      const due = await tx.reminderSchedule.findMany({
        where: { status: 'pending', scheduledAt: { lte: new Date() } },
      });
      const typeMap: Record<string, { type: NotificationType; title: string }> = {
        interim_check: { type: 'interim_check', title: '進捗の中間確認をしましょう' },
        deadline: { type: 'goal_deadline', title: '目標の期限が近づいています' },
        reflection: { type: 'reflection_prompt', title: '振り返りを記録しましょう' },
      };
      let count = 0;
      for (const r of due) {
        const mapped = typeMap[r.triggerType];
        if (!mapped) continue;
        await tx.reminderSchedule.update({ where: { id: r.id }, data: { status: 'due' } });
        await tx.notification.create({
          data: {
            recipientEmployeeId: r.employeeId,
            notificationType: mapped.type,
            title: mapped.title,
            body: `設定した検証タイミングが到来しました（${r.triggerType}）。`,
            relatedType: 'reminder_schedule',
            relatedId: r.id,
            channel: 'in_app',
          },
        });
        count++;
      }
      return count;
    });
  }

  /** Action.dueDateが到来し、まだdoneでないもの。 */
  private async sweepActionDue(): Promise<number> {
    return this.prisma.withSystemBypass(async (tx) => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const due = await tx.action.findMany({
        where: { status: { not: 'done' }, dueDate: { lte: today } },
      });
      let count = 0;
      for (const a of due) {
        const madeit = await this.createIfAbsent(tx, {
          recipientEmployeeId: a.employeeId,
          notificationType: 'action_due',
          title: `「${a.title}」の予定日です`,
          body: '設定した行動の予定日になりました。進み具合を記録しましょう。',
          relatedType: 'action',
          relatedId: a.id,
        });
        if (madeit) count++;
      }
      return count;
    });
  }

  /** UL向け: 1on1準備シートが生成後一定時間レビューされていないもの。 */
  private async sweepOneOnOnePrep(): Promise<number> {
    return this.prisma.withSystemBypass(async (tx) => {
      const threshold = new Date(Date.now() - PREP_SHEET_UNREVIEWED_HOURS * 60 * 60 * 1000);
      const sheets = await tx.oneOnOnePrepSheet.findMany({
        where: { reviewedByUlAt: null, generatedAt: { lte: threshold } },
      });
      let count = 0;
      for (const s of sheets) {
        const madeit = await this.createIfAbsent(tx, {
          recipientEmployeeId: s.unitLeaderId,
          notificationType: 'one_on_one_prep',
          title: '1on1準備シートのレビュー待ちです',
          body: 'AIが生成した1on1準備シートがまだレビューされていません。内容を確認してください。',
          relatedType: 'one_on_one_prep_sheet',
          relatedId: s.id,
        });
        if (madeit) count++;
      }
      return count;
    });
  }

  /** GoalAiInsight: issue_detected/next_action_suggestion→AIからの重要な提案、revision_candidate→目標更新。 */
  private async sweepGoalAiInsights(): Promise<number> {
    return this.prisma.withSystemBypass(async (tx) => {
      const insights = await tx.goalAiInsight.findMany({ where: { status: 'exploring' } });
      let count = 0;
      for (const i of insights) {
        const isRevision = i.kind === 'revision_candidate';
        const madeit = await this.createIfAbsent(tx, {
          recipientEmployeeId: i.employeeId,
          notificationType: isRevision ? 'goal_updated' : 'ai_important_suggestion',
          title: isRevision ? 'AIから目標修正の提案が届いています' : 'AIからの重要な提案があります',
          body: i.contentText,
          relatedType: 'goal_ai_insight',
          relatedId: i.id,
        });
        if (madeit) count++;
      }
      return count;
    });
  }

  /** LongTermGoalがprovisionalのままSMART監査未実施で放置されているもの。 */
  private async sweepSmartIncomplete(): Promise<number> {
    return this.prisma.withSystemBypass(async (tx) => {
      const threshold = new Date(Date.now() - SMART_INCOMPLETE_DAYS * MS_PER_DAY);
      const goals = await tx.longTermGoal.findMany({
        where: { status: 'provisional', smartAuditedAt: null, createdAt: { lte: threshold } },
      });
      let count = 0;
      for (const g of goals) {
        const madeit = await this.createIfAbsent(tx, {
          recipientEmployeeId: g.employeeId,
          notificationType: 'smart_incomplete',
          title: `「${g.title}」のSMARTチェックが未完了です`,
          body: '目標を確定する前に、SMART監査を実施しましょう。',
          relatedType: 'long_term_goal',
          relatedId: g.id,
        });
        if (madeit) count++;
      }
      return count;
    });
  }

  /** 自己分析セッションが一定期間更新されていないもの。放置を検知しstalledへ遷移させたうえで通知する。 */
  private async sweepStalledSelfAnalysis(): Promise<number> {
    return this.prisma.withSystemBypass(async (tx) => {
      const threshold = new Date(Date.now() - STALLED_SELF_ANALYSIS_DAYS * MS_PER_DAY);
      const sessions = await tx.selfAnalysisSession.findMany({
        where: { status: 'exploring', lastActivityAt: { lte: threshold } },
      });
      let count = 0;
      for (const s of sessions) {
        await tx.selfAnalysisSession.update({ where: { id: s.id }, data: { status: 'stalled' } });
        await tx.notification.create({
          data: {
            recipientEmployeeId: s.employeeId,
            notificationType: 'unanswered',
            title: 'AIからの質問にまだ回答していません',
            body: '自己分析の続きがあります。都合の良いときに再開しましょう。',
            relatedType: 'self_analysis_session',
            relatedId: s.id,
            channel: 'in_app',
          },
        });
        count++;
      }
      return count;
    });
  }
}
