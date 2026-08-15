import { IsOptional, IsString } from 'class-validator';

/** Phase4 7.5節「目標を意図的にやめる操作」。理由は任意入力。 */
export class DiscontinueLongTermGoalDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
