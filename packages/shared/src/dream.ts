/**
 * Phase2 2章「夢探索エンジン」。
 * apps/api/prisma/schema.prisma の DreamUserReaction / DreamRevisionTrigger enumと値を一致させる。
 */

/** Phase2 2.2節。DreamHypothesisの提示に対する本人の反応。 */
export const DREAM_USER_REACTIONS = ['agree', 'adjust', 'reject', 'undecided'] as const;
export type DreamUserReaction = (typeof DREAM_USER_REACTIONS)[number];

/** Phase2 2.3節。仮説の再探索・改訂が発生する契機。 */
export const DREAM_REVISION_TRIGGERS = [
  'new_self_analysis_data',
  'new_why_record',
  'periodic_review',
  'member_initiated',
] as const;
export type DreamRevisionTrigger = (typeof DREAM_REVISION_TRIGGERS)[number];
