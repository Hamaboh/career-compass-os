/**
 * <notification>要件。Phase4 16章「Notification UX」の8種別に、本フェーズの指示で追加された
 * 「AIからの重要な提案」を加えた9種別。apps/api/prisma/schema.prisma の NotificationType と
 * 値を一致させる。
 *
 * Phase4 16章とこのフェーズの<notification>要件との対応（一部呼称が異なるため明示的に対応させる）:
 *   action_due            = 行動期限/行動予定
 *   interim_check         = 中間確認
 *   reflection_prompt     = 振り返り
 *   one_on_one_prep       = 1on1準備（Phase4の「1on1」を、UL向け準備シート未レビューの
 *                            エスカレーションも含む形に具体化）
 *   unanswered            = 未回答
 *   smart_incomplete      = SMART未完了（Phase4の「SMART再確認」と同一トリガーとして扱う）
 *   goal_deadline         = 目標期限
 *   goal_updated          = 目標更新
 *   ai_important_suggestion = AIからの重要な提案（Phase4の8種別には明示的な対応がないため、
 *                            GoalAiInsight（issue_detected/next_action_suggestion）向けに
 *                            新設。目標修正候補(revision_candidate)はgoal_updatedに含める）
 */
export const NOTIFICATION_TYPES = [
  'action_due',
  'interim_check',
  'reflection_prompt',
  'one_on_one_prep',
  'unanswered',
  'smart_incomplete',
  'goal_deadline',
  'goal_updated',
  'ai_important_suggestion',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
