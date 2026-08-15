import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

/** directionIdまたはvisionIdのいずれか一方を必須とする（Serviceで検証）。 */
export class GenerateGoalCandidatesDto {
  @ValidateIf((o: GenerateGoalCandidatesDto) => !o.visionId)
  @IsUUID()
  directionId?: string;

  @IsOptional()
  @IsUUID()
  visionId?: string;

  /** <continuous_ai>「次の目標」。達成済み目標のIDを渡すと、その延長線上の候補を優先する。 */
  @IsOptional()
  @IsUUID()
  achievedGoalId?: string;
}
