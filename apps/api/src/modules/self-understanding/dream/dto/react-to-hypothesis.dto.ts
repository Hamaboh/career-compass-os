import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { DREAM_USER_REACTIONS, type DreamUserReaction } from '@career-compass/shared';

export class ReactToHypothesisDto {
  @IsIn(DREAM_USER_REACTIONS)
  reaction!: DreamUserReaction;

  /** reaction='adjust'の場合に必須（Serviceで検証）。本人の言葉での修正版の夢仮説文。 */
  @IsOptional()
  @IsString()
  @MinLength(1)
  adjustedText?: string;
}
