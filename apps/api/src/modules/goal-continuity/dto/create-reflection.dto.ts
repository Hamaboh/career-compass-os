import { IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

/** <goal_management>「振り返り」。CheckpointまたはLongTermGoalの少なくとも一方への紐付けが必須。 */
export class CreateReflectionDto {
  @ValidateIf((o: CreateReflectionDto) => !o.checkpointId)
  @IsUUID()
  longTermGoalId?: string;

  @IsOptional()
  @IsUUID()
  checkpointId?: string;

  /** AIが投げかけた振り返りの問い（任意、getReflectionPrompt()で取得した文言をそのまま渡す想定）。 */
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsString()
  @MinLength(1)
  content!: string;
}
