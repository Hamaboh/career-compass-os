import type { SelfAnalysisCategory } from '@career-compass/shared';

/**
 * Phase2 1.1節(d)「SelfAnalysisBranchRule」の5つの固定ルール。
 * 「初期セットを実装の出発点として固定する」方針に基づき、DB設定ではなくコードロジックとして
 * 実装する（question-bank.ts / emotion-keyword-dictionary.tsと同じ設計判断）。
 *
 * 優先順位（上から評価し、最初にマッチしたルールを採用する）:
 *   1. defer_category   — 明示的な「答えたくない」(isSkip)の場合、このカテゴリを一旦後回しにする
 *   2. deep_dive         — 感情強度が高く、まだ深掘り余地がある場合、同カテゴリを深掘りする
 *   3. synthesize_insight_early — 同カテゴリで十分な回答数が集まった場合、先にインサイト生成を促す
 *   4. reframe           — 回答が極端に短い等、シグナルが弱い場合、聞き方を変えて再度尋ねる
 *   5. advance（デフォルト）— 次の未探索カテゴリの基本問へ進む
 *
 * 本ルールの正確な発火条件はPhase2原文の逐語確認ができておらず、FOUNDATIONの記述パターンに
 * 沿った合理的な実装である旨を完了報告に明記する（design freezeルール4）。
 */

export type BranchDecisionType = 'defer_category' | 'deep_dive' | 'synthesize_insight_early' | 'reframe' | 'advance';

export interface BranchRuleInput {
  isSkip: boolean;
  rawText: string | null;
  dictionaryEmotionIntensity: number;
  depthLevel: number;
  answersInCategoryCount: number;
}

export interface BranchDecision {
  type: BranchDecisionType;
}

const DEEP_DIVE_INTENSITY_THRESHOLD = 30;
const DEEP_DIVE_MAX_DEPTH = 2;
const SYNTHESIZE_MIN_ANSWERS = 3;
const REFRAME_MIN_TEXT_LENGTH = 6;

export function decideBranch(input: BranchRuleInput): BranchDecision {
  if (input.isSkip) {
    return { type: 'defer_category' };
  }

  if (input.dictionaryEmotionIntensity >= DEEP_DIVE_INTENSITY_THRESHOLD && input.depthLevel < DEEP_DIVE_MAX_DEPTH) {
    return { type: 'deep_dive' };
  }

  if (input.answersInCategoryCount >= SYNTHESIZE_MIN_ANSWERS) {
    return { type: 'synthesize_insight_early' };
  }

  if ((input.rawText?.trim().length ?? 0) < REFRAME_MIN_TEXT_LENGTH) {
    return { type: 'reframe' };
  }

  return { type: 'advance' };
}

/** カテゴリ探索順序（Phase2 1.0節の列挙順に準拠）。 */
export const CATEGORY_ORDER: Exclude<SelfAnalysisCategory, 'HIDDEN_STRENGTH'>[] = [
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
];
