import { IsIn } from 'class-validator';
import { ACTION_STATUSES, type ActionStatus } from '@career-compass/shared';

export class UpdateActionStatusDto {
  @IsIn(ACTION_STATUSES)
  status!: ActionStatus;
}
