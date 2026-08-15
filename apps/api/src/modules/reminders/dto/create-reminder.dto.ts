import { IsDateString, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { REMINDER_TRIGGER_TYPES, type ReminderTriggerType } from '@career-compass/shared';

/** <reminder>要件。本人が手動で追加する検証タイミング（自動生成分に加えて任意に追加できる）。 */
export class CreateReminderDto {
  @ValidateIf((o: CreateReminderDto) => !o.checkpointId)
  @IsUUID()
  longTermGoalId?: string;

  @IsOptional()
  @IsUUID()
  checkpointId?: string;

  @IsIn(REMINDER_TRIGGER_TYPES)
  triggerType!: ReminderTriggerType;

  @IsDateString()
  scheduledAt!: string;
}
