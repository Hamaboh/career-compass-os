import { IsIn, IsUUID } from 'class-validator';
import { WHY_SUBJECT_TYPES, type WhySubjectType } from '@career-compass/shared';

export class SubjectQueryDto {
  @IsIn(WHY_SUBJECT_TYPES)
  subjectType!: WhySubjectType;

  @IsUUID()
  subjectId!: string;
}
