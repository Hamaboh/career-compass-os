import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  list() {
    return this.unitsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.unitsService.get(id);
  }

  @Post()
  @RequirePermission('EMPLOYEE_DATA_MANAGE')
  create(@Body() dto: CreateUnitDto, @CurrentEmployee() ctx: RequestContext) {
    return this.unitsService.create(dto, ctx);
  }

  @Patch(':id')
  @RequirePermission('EMPLOYEE_DATA_MANAGE')
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto, @CurrentEmployee() ctx: RequestContext) {
    return this.unitsService.update(id, dto, ctx);
  }
}
