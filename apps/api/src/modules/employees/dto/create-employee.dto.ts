import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { EMPLOYEE_ROLES, type EmployeeRole } from '@career-compass/shared';

export class CreateEmployeeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(EMPLOYEE_ROLES)
  role!: EmployeeRole;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;
}
