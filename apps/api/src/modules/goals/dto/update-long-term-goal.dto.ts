import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateLongTermGoalDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;
}
