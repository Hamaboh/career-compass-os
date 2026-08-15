/**
 * Phase2 1.0節「自己分析エンジン」。
 *
 * 13カテゴリ（要件で挙げられた22項目の質問を集約したもの）。HIDDEN_STRENGTH以外の12は
 * SelfAnalysisQuestionとして直接質問される。HIDDEN_STRENGTHは「自分では気づいていない強み」
 * （1.4節）専用で、AIが他カテゴリの回答から推論して生成するのみで、直接質問はしない。
 *
 * apps/api/prisma/schema.prisma の SelfAnalysisCategory enumと値を一致させる。
 */
export const SELF_ANALYSIS_CATEGORIES = [
  'PAST_EXPERIENCE',
  'SUCCESS_ACHIEVEMENT',
  'FAILURE_DISSATISFACTION',
  'WORK_JOY',
  'WORK_PAIN',
  'STRENGTH_WEAKNESS',
  'INTEREST_CONCERN',
  'VALUES_NONNEGOTIABLE',
  'EXTERNAL_EVALUATION',
  'SKILL_CURRENT_FUTURE',
  'WORKPLACE_CHALLENGE',
  'IDEAL_STATE',
  'HIDDEN_STRENGTH',
] as const;
export type SelfAnalysisCategory = (typeof SELF_ANALYSIS_CATEGORIES)[number];

/** 直接質問の対象となるカテゴリ（HIDDEN_STRENGTHを除く12種、Phase2 1.0節）。 */
export const DIRECTLY_ASKED_CATEGORIES = SELF_ANALYSIS_CATEGORIES.filter(
  (c) => c !== 'HIDDEN_STRENGTH',
) as readonly Exclude<SelfAnalysisCategory, 'HIDDEN_STRENGTH'>[];

/** Phase2 1.3節「自己分析インサイト」の分類。 */
export const INSIGHT_TYPES = ['strength', 'weakness', 'value', 'interest', 'ideal_state', 'challenge'] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];
