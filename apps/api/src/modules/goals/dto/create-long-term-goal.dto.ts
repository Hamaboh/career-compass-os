import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateLongTermGoalDto {
  @IsOptional()
  @IsUUID()
  directionId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;
}
