import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Phase2 1.3節(d)。本人のインサイトへの3種の反応。
 * <ai_principles>「AIの提示に対する最終判断は必ず本人が行う」の実装。
 */
export const INSIGHT_REACTIONS = ['agree', 'adjust', 'reject'] as const;
export type InsightReaction = (typeof INSIGHT_REACTIONS)[number];

export class ReactToInsightDto {
  @IsIn(INSIGHT_REACTIONS)
  reaction!: InsightReaction;

  /** reaction='adjust'の場合、本人の言葉での上書き文を必須とする（Controller/Serviceで検証）。 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  editText?: string;
}
