import { Body, Controller, Get, Ip, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
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

    return { id: employee.id, name: employee.name, role: employee.role };
  }
}
