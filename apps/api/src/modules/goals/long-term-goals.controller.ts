import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateLongTermGoalDto } from './dto/create-long-term-goal.dto';
import { UpdateLongTermGoalDto } from './dto/update-long-term-goal.dto';
import { CreateCheckpointForGoalDto } from './dto/create-checkpoint-for-goal.dto';
import { ConfirmLongTermGoalDto } from './dto/confirm-long-term-goal.dto';
import { SmartGuidanceQuestionDto } from './dto/smart-guidance-question.dto';
import { DiscontinueLongTermGoalDto } from './dto/discontinue-long-term-goal.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('long-term-goals')
export class LongTermGoalsController {
  constructor(private readonly service: GoalsService) {}

  @Post()
  @RequirePermission('SELF_DATA_EDIT')
  create(@Body() dto: CreateLongTermGoalDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createLongTermGoal(dto, ctx);
  }

  /** <smart_guidance>要件。目標作成中、下書きを渡すとSMARTの観点で誘導質問が返る。 */
  @Post('smart-guidance-question')
  @RequirePermission('SELF_DATA_EDIT')
  smartGuidanceQuestion(@Body() dto: SmartGuidanceQuestionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.getSmartGuidanceQuestion(dto, ctx);
  }

  /** employeeIdはUL/ADMINが自Unitメンバーの目標一覧を見るためのオプション指定（UL-04/UL-03用）。 */
  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(@Query('employeeId') employeeId: string | undefined, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listLongTermGoals(ctx, employeeId);
  }

  @Get(':id')
  @RequirePermission('SELF_DATA_VIEW')
  get(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.getLongTermGoal(id, ctx);
  }

  @Patch(':id')
  @RequirePermission('SELF_DATA_EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateLongTermGoalDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.updateLongTermGoal(id, dto, ctx);
  }

  /** <smart_gate>要件。目標保存直前のSMART監査を実行する。 */
  @Post(':id/smart-audit')
  @RequirePermission('SELF_DATA_EDIT')
  runSmartAudit(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.runSmartAudit(id, ctx);
  }

  @Post(':id/confirm')
  @RequirePermission('SELF_DATA_EDIT')
  confirm(@Param('id') id: string, @Body() dto: ConfirmLongTermGoalDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.confirmLongTermGoal(id, dto, ctx);
  }

  /** <goal_management>「目標期限」のライフサイクル完了。達成済みにマークする。 */
  @Post(':id/achieve')
  @RequirePermission('SELF_DATA_EDIT')
  achieve(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.achieveLongTermGoal(id, ctx);
  }

  /** Phase4 7.5節「目標を意図的にやめる操作」。削除ではなく状態遷移(discontinued)。 */
  @Post(':id/discontinue')
  @RequirePermission('SELF_DATA_EDIT')
  discontinue(@Param('id') id: string, @Body() dto: DiscontinueLongTermGoalDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.discontinueLongTermGoal(id, dto.reason, ctx);
  }

  /** <goal_management>「目標変更履歴」。 */
  @Get(':id/change-logs')
  @RequirePermission('SELF_DATA_VIEW')
  changeLogs(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listChangeLogs('long_term_goal', id, ctx);
  }

  @Get(':id/checkpoints')
  @RequirePermission('SELF_DATA_VIEW')
  listCheckpoints(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listCheckpoints(id, ctx);
  }

  @Post(':id/checkpoints')
  @RequirePermission('SELF_DATA_EDIT')
  createCheckpoint(
    @Param('id') id: string,
    @Body() dto: CreateCheckpointForGoalDto,
    @CurrentEmployee() ctx: RequestContext,
  ) {
    return this.service.createCheckpoint({ ...dto, longTermGoalId: id }, ctx);
  }
}
