import { IsOptional, IsString, MinLength } from 'class-validator';

/** <smart_guidance>要件。目標作成中に呼び出す、SMARTを意識した誘導質問の取得用。 */
export class SmartGuidanceQuestionDto {
  @IsString()
  @MinLength(1)
  draftTitle!: string;

  @IsOptional()
  @IsString()
  draftDescription?: string;

  @IsOptional()
  @IsString()
  draftTargetDate?: string;
}
