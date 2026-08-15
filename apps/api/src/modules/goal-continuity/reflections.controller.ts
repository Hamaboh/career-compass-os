import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GoalContinuityService } from './goal-continuity.service';
import { CreateReflectionDto } from './dto/create-reflection.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('reflections')
export class ReflectionsController {
  constructor(private readonly service: GoalContinuityService) {}

  /** <continuous_ai>「振り返り」。AIが振り返りを引き出す問いを生成する（保存はしない）。 */
  @Get('prompt')
  @RequirePermission('SELF_DATA_VIEW')
  prompt(
    @Query('longTermGoalId') longTermGoalId: string | undefined,
    @Query('checkpointId') checkpointId: string | undefined,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.service.getReflectionPrompt({ longTermGoalId, checkpointId }, ctx);
  }

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  create(@Body() dto: CreateReflectionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createReflection(dto, ctx);
  }

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(
    @Query('longTermGoalId') longTermGoalId: string | undefined,
    @Query('checkpointId') checkpointId: string | undefined,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.service.listReflections({ longTermGoalId, checkpointId }, ctx);
  }
}
