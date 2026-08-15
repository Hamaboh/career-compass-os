import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OneOnOneService } from './one-on-one.service';
import { CreateOneOnOneSessionDto } from './dto/create-one-on-one-session.dto';
import { CompleteOneOnOneSessionDto } from './dto/complete-one-on-one-session.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

/**
 * <one_on_one>要件。準備シート系エンドポイントはAPP_EDIT（UL/ADMIN、「他者データへの支援操作」）
 * で保護し、本人(MEMBER)はアクセスできない。RLSでも二重に保護されている（migration参照）。
 */
@Controller('one-on-one')
export class OneOnOneController {
  constructor(private readonly service: OneOnOneService) {}

  @Post('prep-sheets')
  @RequirePermission('APP_EDIT')
  generatePrepSheet(@Body('employeeId') employeeId: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.generatePrepSheet(employeeId, ctx);
  }

  @Get('prep-sheets')
  @RequirePermission('APP_EDIT')
  listPrepSheets(@Query('employeeId') employeeId: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listPrepSheetsForMember(employeeId, ctx);
  }

  @Get('prep-sheets/:id')
  @RequirePermission('APP_EDIT')
  getPrepSheet(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.getPrepSheet(id, ctx);
  }

  @Post('prep-sheets/:id/mark-reviewed')
  @RequirePermission('APP_EDIT')
  markReviewed(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.markPrepSheetReviewed(id, ctx);
  }

  @Post('sessions')
  @RequirePermission('APP_EDIT')
  createSession(@Body() dto: CreateOneOnOneSessionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.createSession(dto, ctx);
  }

  /** 本人としても、担当ULとしても、自分に関わる1on1セッションを見られる（RLSが両立場を合成する）。 */
  @Get('sessions/me')
  @RequirePermission('SELF_DATA_VIEW')
  listMySessions(@CurrentEmployee() ctx: RequestContext) {
    return this.service.listMySessions(ctx);
  }

  @Get('sessions')
  @RequirePermission('APP_EDIT')
  listSessionsForMember(@Query('employeeId') employeeId: string, @CurrentEmployee() ctx: RequestContext) {
    return this.service.listSessionsForMember(employeeId, ctx);
  }

  @Post('sessions/:id/complete')
  @RequirePermission('APP_EDIT')
  completeSession(@Param('id') id: string, @Body() dto: CompleteOneOnOneSessionDto, @CurrentEmployee() ctx: RequestContext) {
    return this.service.completeSession(id, dto, ctx);
  }
}
