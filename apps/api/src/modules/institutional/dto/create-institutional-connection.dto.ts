import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import {
  INSTITUTION_CONNECTABLE_TYPES,
  INSTITUTION_TYPES,
  RELEVANCE_LABELS,
  type InstitutionConnectableType,
  type InstitutionType,
  type RelevanceLabel,
} from '@career-compass/shared';

/**
 * <company_alignment>要件の実装。growthNoteを必須項目とすることで、
 * 「会社KPI/ULM→本人の成長」の接続確認をデータ構造として強制する。
 */
export class CreateInstitutionalConnectionDto {
  @IsIn(INSTITUTION_CONNECTABLE_TYPES)
  connectableType!: InstitutionConnectableType;

  @IsUUID()
  connectableId!: string;

  @IsIn(INSTITUTION_TYPES)
  institutionType!: InstitutionType;

  @IsUUID()
  institutionId!: string;

  @IsIn(RELEVANCE_LABELS)
  relevanceLabel!: RelevanceLabel;

  @IsString()
  @MinLength(1)
  growthNote!: string;

  @IsOptional()
  @IsString()
  careerNote?: string;
}
