import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * Phase3 5.B節「append-onlyバージョン管理」。改定のたびに新しいバージョン行を追加する
 * （既存行を上書きしない）。change_reasonはversion_no>=2で必須だが、1件目(初版)からの
 * 改定は常にversion_no>=2になるため、このDTOでは必須にする。
 */
export class CreateInstitutionVersionDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  changeReason!: string;
}

export class CreateUlmVersionDto extends CreateInstitutionVersionDto {
  @IsOptional()
  @IsUUID()
  unitId?: string;
}
