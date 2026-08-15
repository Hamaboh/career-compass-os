import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateDirectionDto } from './dto/create-direction.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('directions')
export class DirectionsController {
  constructor(private readonly service: GoalsService) {}

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  create(@Body() dto: CreateDirectionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createDirection(dto, ctx);
  }

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listDirections(ctx);
  }

  @Get(':id')
  @RequirePermission('SELF_DATA_VIEW')
  get(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.getDirection(id, ctx);
  }

  @Get(':id/change-logs')
  @RequirePermission('SELF_DATA_VIEW')
  changeLogs(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listChangeLogs('direction', id, ctx);
  }
}
