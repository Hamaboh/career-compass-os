import { Body, Controller, Get, Ip, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @RequirePermission('EMPLOYEE_DATA_MANAGE')
  create(@Body() dto: CreateInvitationDto, @CurrentEmployee() ctx: RequestContext) {
    return this.invitationsService.create(dto.employeeId, ctx);
  }

  @Get()
  @RequirePermission('EMPLOYEE_DATA_MANAGE')
  list(@CurrentEmployee() ctx: RequestContext) {
    return this.invitationsService.list(ctx);
  }

  @Post(':id/revoke')
  @RequirePermission('EMPLOYEE_DATA_MANAGE')
  revoke(@Param('id') id: string, @CurrentEmployee() ctx: RequestContext) {
    return this.invitationsService.revoke(id, ctx);
  }

  @Get(':token')
  @Public()
  getByToken(@Param('token') token: string) {
    return this.invitationsService.getByToken(token);
  }

  @Post(':token/send-otp')
  @Public()
  sendOtp(@Param('token') token: string, @Ip() ip: string) {
    return this.invitationsService.sendOtp(token, ip);
  }

  @Post(':token/verify-otp')
  @Public()
  verifyOtp(@Param('token') token: string, @Body() dto: VerifyOtpDto, @Ip() ip: string) {
    return this.invitationsService.verifyOtp(token, dto.code, ip);
  }

  @Post(':token/set-password')
  @Public()
  async setPassword(
    @Param('token') token: string,
    @Body() dto: SetPasswordDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { employee, session } = await this.invitationsService.setPassword(
      token,
      dto.password,
      dto.passwordConfirmation,
      ip,
      req.header('user-agent') ?? null,
    );

    res.cookie(this.config.getOrThrow<string>('SESSION_COOKIE_NAME'), session.rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: session.expiresAt,
    });

    // Phase3 16.3節・Phase4 3.1節「設定完了→初回ダッシュボードへ自動遷移」。auth.controller.tsの
    // login()と同様にCSRFトークンも同時発行する（2026-08-15、フロントエンド実装時に発見・修正:
    // 旧実装はセッションCookieのみを発行しCSRF Cookieを発行していなかったため、初回パスワード設定
    // 直後の最初の状態変更リクエストが軒並み403(CSRFトークン不一致)になる欠陥があった）。
    const csrfToken = randomBytes(32).toString('base64url');
    res.cookie(this.config.getOrThrow<string>('CSRF_COOKIE_NAME'), csrfToken, {
      httpOnly: false,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: session.expiresAt,
    });

    return { id: employee.id, name: employee.name, role: employee.role };
  }
}
