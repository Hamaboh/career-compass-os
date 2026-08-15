import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GoalContinuityService } from './goal-continuity.service';
import { ReactToAiInsightDto } from './dto/react-to-ai-insight.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

/** <continuous_ai>「課題発見」「目標修正候補」「次アクション」。 */
@Controller()
export class GoalAiInsightsController {
  constructor(private readonly service: GoalContinuityService) {}

  @Post('long-term-goals/:goalId/ai-insights/analyze')
  @RequirePermission('SELF_DATA_EDIT')
  analyze(@Param('goalId') goalId: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.runAiAnalysis(goalId, ctx);
  }

  @Get('long-term-goals/:goalId/ai-insights')
  @RequirePermission('SELF_DATA_VIEW')
  list(@Param('goalId') goalId: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listAiInsights(goalId, ctx);
  }

  @Post('ai-insights/:id/react')
  @RequirePermission('SELF_DATA_EDIT')
  react(@Param('id') id: string, @Body() dto: ReactToAiInsightDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.reactToAiInsight(id, dto.reaction, ctx);
  }
}
