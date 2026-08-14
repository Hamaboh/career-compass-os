/**
 * Phase2 FOUNDATION §0.2「共通ステータス語彙」。
 *
 * 目標階層オブジェクト（Vision/Direction/LongTermGoal/Checkpoint/Action/Evidence/Reflection、
 * InstitutionalConnection、WhyRecord）の status には、この9値のみを使用する。
 * それ以外のワークフロー・運用ログ用レコード（進捗確認イベント、リマインダー配信、
 * 修正検討リクエスト、1on1準備シート項目、次アクション提案プール等）は、
 * この9語彙とは別名前空間の独自ステータスを持ってよいが、目標階層のstatusを
 * 置き換えるものではない（別途 delivery_status 等、ドメインごとの型を定義すること）。
 *
 * この配列・型を変更することはPhase2の確定仕様を変更することを意味する。
 * 変更が必要になった場合は docs/DESIGN_FREEZE.md ルール2/3 に従い、実装を進める前に報告する。
 */
export const GOAL_HIERARCHY_STATUSES = [
  'exploring',
  'provisional',
  'confirmed',
  'active',
  'stalled',
  'under_review',
  'achieved',
  'discontinued',
  'archived',
] as const;

export type GoalHierarchyStatus = (typeof GOAL_HIERARCHY_STATUSES)[number];
