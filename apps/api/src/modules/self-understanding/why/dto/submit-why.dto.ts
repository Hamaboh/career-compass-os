import { IsIn, IsString, IsUUID, MinLength } from 'class-validator';
import { WHY_SUBJECT_TYPES, type WhySubjectType } from '@career-compass/shared';

export class SubmitWhyDto {
  @IsIn(WHY_SUBJECT_TYPES)
  subjectType!: WhySubjectType;

  @IsUUID()
  subjectId!: string;

  @IsString()
  @MinLength(1)
  userText!: string;
}
