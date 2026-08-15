import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GoalContinuityService } from './goal-continuity.service';
import { CreateProgressEntryDto } from './dto/create-progress-entry.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('progress-entries')
export class ProgressController {
  constructor(private readonly service: GoalContinuityService) {}

  /** <continuous_ai>「進捗確認」。AIが状況確認の問いを生成する（保存はしない）。 */
  @Get('checkin-question')
  @RequirePermission('SELF_DATA_VIEW')
  checkinQuestion(
    @Query('longTermGoalId') longTermGoalId: string | undefined,
    @Query('checkpointId') checkpointId: string | undefined,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.service.getProgressCheckinQuestion({ longTermGoalId, checkpointId }, ctx);
  }

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  create(@Body() dto: CreateProgressEntryDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createProgressEntry(dto, ctx);
  }

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(
    @Query('longTermGoalId') longTermGoalId: string | undefined,
    @Query('checkpointId') checkpointId: string | undefined,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.service.listProgress({ longTermGoalId, checkpointId }, ctx);
  }
}
