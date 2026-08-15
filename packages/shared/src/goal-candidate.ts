/**
 * <implementation_scope> 14.AIによる目標候補生成 / 15.ユーザーによる確定。
 * GoalCandidateは提案段階のオブジェクトであり、目標階層のGOAL_HIERARCHY_STATUSES（[[status]]）とは
 * 別名前空間のステータスを持つ（FOUNDATION §0.2の「それ以外のワークフロー用レコード」に該当）。
 * apps/api/prisma/schema.prisma の GoalCandidateStatus enumと値を一致させる。
 */
export const GOAL_CANDIDATE_STATUSES = ['proposed', 'accepted', 'rejected'] as const;
export type GoalCandidateStatus = (typeof GOAL_CANDIDATE_STATUSES)[number];
