import { IsDateString, IsIn, IsString, MinLength } from 'class-validator';
import { EVALUATION_PERIOD_TYPES, type EvaluationPeriodType } from '@career-compass/shared';

/** ADM-06 人事評価制度管理。idは人間可読文字列をそのまま採番する（Phase3 5.B節）。 */
export class CreateEvaluationPeriodDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsIn(EVALUATION_PERIOD_TYPES)
  periodType!: EvaluationPeriodType;

  @IsDateString()
  periodStartDate!: string;

  @IsDateString()
  periodEndDate!: string;

  @IsString()
  @MinLength(1)
  periodLabel!: string;
}
