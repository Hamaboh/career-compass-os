import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * <smart_gate>要件。「SMART監査を通過、または本人が合理的な理由を承認した場合のみ確定可能」の
 * 実装。SMART監査が全項目okでない場合、smartOverrideReasonが必須になる（Serviceで検証）。
 */
export class ConfirmLongTermGoalDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  smartOverrideReason?: string;
}
