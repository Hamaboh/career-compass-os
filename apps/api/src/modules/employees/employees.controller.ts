import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  /** SELF_DATA_VIEW: 自分自身の情報。ルーティング順序上、:id より先に置く。 */
  @Get('me')
  me(@CurrentEmployee() ctx: RequestContext) {
    return this.employeesService.me(ctx);
  }

  @Get()
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.employeesService.list(ctx);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.employeesService.get(id, ctx);
  }

  @Post()
  @RequirePermission('EMPLOYEE_DATA_MANAGE')
  create(@Body() dto: CreateEmployeeDto, @CurrentEmployee() ctx: RequestContext) {
    return this.employeesService.create(dto, ctx);
  }

  @Patch(':id')
  @RequirePermission('EMPLOYEE_DATA_MANAGE')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentEmployee() ctx: RequestContext) {
    return this.employeesService.update(id, dto, ctx);
  }

  @Patch(':id/role')
  @RequirePermission('USER_ROLE_MANAGE')
  changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.employeesService.changeRole(id, dto, ctx);
  }

  @Patch(':id/status')
  @RequirePermission('EMPLOYEE_DATA_MANAGE')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.employeesService.changeStatus(id, dto, ctx);
  }
}
