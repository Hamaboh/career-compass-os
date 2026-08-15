import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCheckpointDto {
  @IsUUID()
  longTermGoalId!: string;

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
