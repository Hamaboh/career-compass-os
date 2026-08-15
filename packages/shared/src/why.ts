/**
 * Phase2 FOUNDATION §0.1。WhyRecordはVision/Direction/LongTermGoal/Checkpointの
 * いずれにも多重添付できる独立オブジェクト。
 * apps/api/prisma/schema.prisma の WhySubjectType enumと値を一致させる。
 */
export const WHY_SUBJECT_TYPES = ['vision', 'direction', 'long_term_goal', 'checkpoint'] as const;
export type WhySubjectType = (typeof WHY_SUBJECT_TYPES)[number];
