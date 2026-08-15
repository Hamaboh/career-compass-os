import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { SELF_ANALYSIS_CATEGORIES, type SelfAnalysisCategory } from '@career-compass/shared';

/**
 * 直前にサーバーから提示された質問の内容をクライアントがそのまま echo back する
 * ステートレスな設計（SelfAnalysisSession自体には「現在の質問」を持たせない。
 * 質問と回答は1:1でSelfAnalysisAnswerに保存されるため、セッション側の状態を二重管理しない）。
 */
export class SubmitAnswerDto {
  @IsIn(SELF_ANALYSIS_CATEGORIES)
  categoryCode!: SelfAnalysisCategory;

  @IsString()
  @MinLength(1)
  questionText!: string;

  @IsInt()
  @Min(0)
  depthLevel!: number;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsBoolean()
  isSkip?: boolean;
}
