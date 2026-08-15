import { Controller, Get, Param, Post } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('checkpoints')
export class CheckpointsController {
  constructor(private readonly service: GoalsService) {}

  @Post(':id/confirm')
  @RequirePermission('SELF_DATA_EDIT')
  confirm(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.confirmCheckpoint(id, ctx);
  }

  @Get(':id/change-logs')
  @RequirePermission('SELF_DATA_VIEW')
  changeLogs(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listChangeLogs('checkpoint', id, ctx);
  }
}
