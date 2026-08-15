import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** 氏名・所属Unitの変更（社員情報管理、EMPLOYEE_DATA_MANAGE）。role/account_statusは専用エンドポイント。 */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @IsOptional()
  @IsUUID()
  positionId?: string | null;
}
