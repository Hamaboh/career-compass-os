import { IsIn } from 'class-validator';

/** <ai_principles>「最終判断は必ず本人が行う」の実装。 */
export const AI_INSIGHT_REACTIONS = ['accept', 'dismiss'] as const;
export type AiInsightReaction = (typeof AI_INSIGHT_REACTIONS)[number];

export class ReactToAiInsightDto {
  @IsIn(AI_INSIGHT_REACTIONS)
  reaction!: AiInsightReaction;
}
