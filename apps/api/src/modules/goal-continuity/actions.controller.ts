import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { GoalContinuityService } from './goal-continuity.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionStatusDto } from './dto/update-action-status.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('actions')
export class ActionsController {
  constructor(private readonly service: GoalContinuityService) {}

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  create(@Body() dto: CreateActionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createAction(dto, ctx);
  }

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(
    @Query('longTermGoalId') longTermGoalId: string | undefined,
    @Query('checkpointId') checkpointId: string | undefined,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.service.listActions({ longTermGoalId, checkpointId }, ctx);
  }

  @Patch(':id/status')
  @RequirePermission('SELF_DATA_EDIT')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateActionStatusDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.updateActionStatus(id, dto, ctx);
  }

  @Post(':id/evidence')
  @RequirePermission('SELF_DATA_EDIT')
  createEvidence(@Param('id') id: string, @Body() dto: CreateEvidenceDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createEvidence(id, dto, ctx);
  }

  @Get(':id/evidence')
  @RequirePermission('SELF_DATA_VIEW')
  listEvidence(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listEvidence(id, ctx);
  }
}
