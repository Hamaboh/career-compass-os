import { RELEVANCE_LABELS, type RelevanceLabel } from '@career-compass/shared';

/**
 * Phase2 FOUNDATION §0.4「心理指標の共通表示ルール」。
 * confidence_score_internal / emotion_intensity_internal / conviction_score_internal 等の
 * 内部スコア(0〜100)は、生の数値のままAPIレスポンスに含めてはならない。5段階の質的ラベルに
 * 変換したうえで、「AIによる参考指標」である旨の注記を必ず添えて公開する。
 * UL/Adminは個々のスコアではなく傾向（トレンド）のみを見られる、という設計になっているため、
 * 本Stepのレスポンスは本人向けのラベル表示のみを実装し、UL/Admin向けのトレンド集計は
 * 別Stepのスコープとする（要件外拡張をしない）。
 */
export const AI_INDICATOR_DISCLAIMER = 'AIによる参考指標です。断定的な評価ではありません。';

export function scoreToLabel(score: number): RelevanceLabel {
  if (score < 20) return RELEVANCE_LABELS[0]; // very_low
  if (score < 40) return RELEVANCE_LABELS[1]; // low
  if (score < 60) return RELEVANCE_LABELS[2]; // medium
  if (score < 80) return RELEVANCE_LABELS[3]; // high
  return RELEVANCE_LABELS[4]; // very_high
}

export interface QualitativeIndicator {
  label: RelevanceLabel;
  note: string;
}

export function toQualitativeIndicator(score: number | null | undefined): QualitativeIndicator | null {
  if (score === null || score === undefined) return null;
  return { label: scoreToLabel(score), note: AI_INDICATOR_DISCLAIMER };
}
