import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength, ValidateIf } from 'class-validator';

/** <goal_management>「進捗」。CheckpointまたはLongTermGoalの少なくとも一方への紐付けが必須。 */
export class CreateProgressEntryDto {
  @ValidateIf((o: CreateProgressEntryDto) => !o.checkpointId)
  @IsUUID()
  longTermGoalId?: string;

  @IsOptional()
  @IsUUID()
  checkpointId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  percentComplete?: number;

  @IsString()
  @MinLength(1)
  statusNote!: string;
}
