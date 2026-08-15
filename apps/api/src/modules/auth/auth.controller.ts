import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import type { RequestContext } from '../../common/context/request-context';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { employee, session } = await this.authService.login(
      dto.email,
      dto.password,
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

    // Phase3 16.3節: ログイン成功時にCSRFトークンを発行する（Double Submit Cookie）。
    const csrfToken = randomBytes(32).toString('base64url');
    res.cookie(this.config.getOrThrow<string>('CSRF_COOKIE_NAME'), csrfToken, {
      httpOnly: false,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: session.expiresAt,
    });

    return { id: employee.id, name: employee.name, role: employee.role, unitId: employee.unitId };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentEmployee() ctx: RequestContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenHash = (req as unknown as { sessionTokenHash?: string }).sessionTokenHash;
    if (tokenHash) {
      await this.authService.logout(tokenHash, ctx.employeeId, ctx.ipAddress);
    }
    res.clearCookie(this.config.getOrThrow<string>('SESSION_COOKIE_NAME'), { path: '/' });
    res.clearCookie(this.config.getOrThrow<string>('CSRF_COOKIE_NAME'), { path: '/' });
  }

  @Get('session')
  session(@CurrentEmployee() ctx: RequestContext) {
    return { employeeId: ctx.employeeId, role: ctx.role, unitId: ctx.unitId };
  }

  @Post('password-reset/request')
  @Public()
  @HttpCode(HttpStatus.OK)
  requestReset(@Body() dto: RequestPasswordResetDto, @Ip() ip: string) {
    return this.authService.requestPasswordReset(dto.email, ip);
  }

  @Post('password-reset/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  confirmReset(@Body() dto: ConfirmPasswordResetDto, @Ip() ip: string) {
    return this.authService.confirmPasswordReset(dto.token, dto.password, dto.passwordConfirmation, ip);
  }

  /** MEM-16 プロフィール「パスワード変更」（ログイン中の本人操作。忘れた場合のリセットとは別経路）。 */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentEmployee() ctx: RequestContext, @Req() req: Request, @Ip() ip: string) {
    const tokenHash = (req as unknown as { sessionTokenHash?: string }).sessionTokenHash;
    return this.authService.changePassword(
      ctx.employeeId,
      dto.currentPassword,
      dto.newPassword,
      dto.newPasswordConfirmation,
      tokenHash ?? '',
      ip,
    );
  }
}
