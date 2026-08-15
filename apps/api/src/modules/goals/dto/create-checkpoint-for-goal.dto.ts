import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

/** POST /long-term-goals/:id/checkpoints 用。longTermGoalIdはURLパスパラメータから取るため含まない。 */
export class CreateCheckpointForGoalDto {
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
