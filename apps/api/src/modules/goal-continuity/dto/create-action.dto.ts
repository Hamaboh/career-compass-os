import { IsDateString, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

/** <goal_management>「行動」。CheckpointまたはLongTermGoalの少なくとも一方への紐付けが必須。 */
export class CreateActionDto {
  @ValidateIf((o: CreateActionDto) => !o.longTermGoalId)
  @IsUUID()
  checkpointId?: string;

  @IsOptional()
  @IsUUID()
  longTermGoalId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
