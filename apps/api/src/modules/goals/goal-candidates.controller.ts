import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GenerateGoalCandidatesDto } from './dto/generate-goal-candidates.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

/** <implementation_scope> 14.AIによる目標候補生成 / 15.ユーザーによる確定。 */
@Controller('goal-candidates')
export class GoalCandidatesController {
  constructor(private readonly service: GoalsService) {}

  @Post('generate')
  @RequirePermission('SELF_DATA_EDIT')
  generate(@Body() dto: GenerateGoalCandidatesDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.generateCandidates(dto, ctx);
  }

  @Get()
  @RequirePermission('SELF_DATA_VIEW')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listCandidates(ctx);
  }

  @Post(':id/accept')
  @RequirePermission('SELF_DATA_EDIT')
  accept(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.acceptCandidate(id, ctx);
  }

  @Post(':id/reject')
  @RequirePermission('SELF_DATA_EDIT')
  reject(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.rejectCandidate(id, ctx);
  }
}
