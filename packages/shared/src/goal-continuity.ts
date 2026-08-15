/**
 * <goal_management>/<continuous_ai>要件。目標確定後の継続支援ドメインの語彙。
 * apps/api/prisma/schema.prisma の対応するenumと値を一致させる。
 */

/** GoalChangeLogの対象（Visionは編集履歴追跡の対象外）。 */
export const GOAL_CHANGE_SUBJECT_TYPES = ['direction', 'long_term_goal', 'checkpoint'] as const;
export type GoalChangeSubjectType = (typeof GOAL_CHANGE_SUBJECT_TYPES)[number];

export const GOAL_CHANGE_ACTIONS = ['created', 'updated', 'status_changed', 'confirmed', 'smart_audited'] as const;
export type GoalChangeAction = (typeof GOAL_CHANGE_ACTIONS)[number];

/** <goal_management>「行動」の状態。 */
export const ACTION_STATUSES = ['not_started', 'in_progress', 'done', 'blocked'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/**
 * <continuous_ai>「課題発見」「目標修正候補」「次アクション」の種類。
 * 「次の目標」はGoalCandidateを再利用するためここには含まない。
 */
export const GOAL_AI_INSIGHT_KINDS = ['issue_detected', 'revision_candidate', 'next_action_suggestion'] as const;
export type GoalAiInsightKind = (typeof GOAL_AI_INSIGHT_KINDS)[number];

/** <reminder>要件。期限だけでなく中間チェック・振り返りも対象にする。 */
export const REMINDER_TRIGGER_TYPES = ['interim_check', 'deadline', 'reflection'] as const;
export type ReminderTriggerType = (typeof REMINDER_TRIGGER_TYPES)[number];

export const REMINDER_STATUSES = ['pending', 'due', 'completed', 'skipped'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

/** <one_on_one>実施記録のステータス。 */
export const ONE_ON_ONE_SESSION_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
export type OneOnOneSessionStatus = (typeof ONE_ON_ONE_SESSION_STATUSES)[number];
