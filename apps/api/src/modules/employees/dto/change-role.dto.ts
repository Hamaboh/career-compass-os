import { IsIn } from 'class-validator';
import { EMPLOYEE_ROLES, type EmployeeRole } from '@career-compass/shared';

/** Phase3 7.1節: role変更は USER_ROLE_MANAGE（EMPLOYEE_DATA_MANAGEとは独立した権限）。 */
export class ChangeRoleDto {
  @IsIn(EMPLOYEE_ROLES)
  role!: EmployeeRole;
}
