import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SelfAnalysisService } from './self-analysis.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { ReactToInsightDto } from './dto/react-to-insight.dto';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../../common/context/request-context';

/**
 * Phase3 7.3節: 自己分析データは本人のSELF_DATA_EDIT/VIEWでのみ操作する。
 * RLS（self_analysis_*_self_all等）により、ADMIN/ULであっても他者のデータへの
 * 書き込みは一切できない（<constraints>「個人データを他ユーザーに漏らさない」の実装）。
 * UL/Adminによる自Unitメンバーの閲覧APIは本Stepのスコープ外（RLS側は既に対応済みだが、
 * このStepでは本人向けエンドポイントのみを実装する。完了報告に申し送り事項として記載）。
 */
@Controller('self-analysis')
export class SelfAnalysisController {
  constructor(private readonly service: SelfAnalysisService) {}

  @Post('sessions')
  @RequirePermission('SELF_DATA_EDIT')
  startSession(@CurrentEmployee() ctx: RequestContext) {
    return this.service.startSession(ctx);
  }

  @Get('sessions')
  @RequirePermission('SELF_DATA_VIEW')
  listSessions(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listSessions(ctx);
  }

  @Get('sessions/:id')
  @RequirePermission('SELF_DATA_VIEW')
  getSession(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.getSession(id, ctx);
  }

  @Get('sessions/:id/answers')
  @RequirePermission('SELF_DATA_VIEW')
  listAnswers(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listAnswers(id, ctx);
  }

  @Post('sessions/:id/answers')
  @RequirePermission('SELF_DATA_EDIT')
  submitAnswer(@Param('id') id: string, @Body() dto: SubmitAnswerDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.submitAnswer(id, dto, ctx);
  }

  @Post('sessions/:id/confirm')
  @RequirePermission('SELF_DATA_EDIT')
  confirmSession(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.confirmSession(id, ctx);
  }

  @Get('insights')
  @RequirePermission('SELF_DATA_VIEW')
  listInsights(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listInsights(ctx);
  }

  @Post('insights/hidden-strength')
  @RequirePermission('SELF_DATA_EDIT')
  generateHiddenStrength(@CurrentEmployee() ctx: RequestContext) {
    return this.service.generateHiddenStrength(ctx);
  }

  @Post('insights/:id/react')
  @RequirePermission('SELF_DATA_EDIT')
  reactToInsight(@Param('id') id: string, @Body() dto: ReactToInsightDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.reactToInsight(id, dto, ctx);
  }
}
