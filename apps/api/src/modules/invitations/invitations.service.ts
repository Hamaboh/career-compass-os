import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { SessionService } from '../auth/session.service';
import { RateLimiterService } from '../../common/security/rate-limiter.service';
import { TooManyRequestsException } from '../../common/exceptions/http-exceptions';
import { generateOpaqueToken, generateOtp, hashToken, safeCompareHex } from '../../common/crypto/tokens';
import { hashPassword } from '../../common/security/password-hash';
import { validatePasswordPolicy } from '../../common/security/password-policy';
import type { RequestContext } from '../../common/context/request-context';

/**
 * Phase3 9〜12章「招待→OTP→パスワード設定」フローの実装。
 *
 * 招待対象者はまだセッションを持たない（=RequestContextが存在しない）ため、対象employeeへの
 * アクセスは PrismaService.withSystemBypass() を使う。ADMIN操作（作成・失効）はPermissionGuardで
 * 既にEMPLOYEE_DATA_MANAGEを確認済みなので withRlsContext(ctx, ...) でよい。
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mail: MailService,
    private readonly sessionService: SessionService,
    private readonly rateLimiter: RateLimiterService,
    private readonly config: ConfigService,
  ) {}

  // ---- ADMIN操作 ----

  async create(employeeId: string, ctx: RequestContext) {
    const employee = await this.prisma.withRlsContext(ctx, (tx) =>
      tx.employee.findUnique({ where: { id: employeeId } }),
    );
    if (!employee) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '社員が見つかりません' } });
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const ttlHours = this.config.getOrThrow<number>('INVITATION_TOKEN_TTL_HOURS');
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

    const invitation = await this.prisma.invitation.create({
      data: { employeeId, tokenHash, expiresAt, status: 'pending' },
    });

    await this.prisma.withRlsContext(ctx, (tx) =>
      tx.employee.update({ where: { id: employeeId }, data: { invitationStatus: 'invited' } }),
    );

    await this.mail.send(
      employee.email,
      '【羅針盤キャリアOS】招待のご案内',
      `以下のリンクから招待を受け入れてください（${ttlHours}時間有効）:\nhttps://localhost/invitations/${rawToken}`,
    );

    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'invitation.create',
      targetType: 'employee',
      targetId: employeeId,
      after: { invitationId: invitation.id, expiresAt },
      ipAddress: ctx.ipAddress,
    });

    return { id: invitation.id, expiresAt };
  }

  async revoke(invitationId: string, ctx: RequestContext) {
    const invitation = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'revoked', revokedAt: new Date() },
    });
    await this.auditLog.record({
      actorEmployeeId: ctx.employeeId,
      actorType: 'human',
      action: 'invitation.revoke',
      targetType: 'invitation',
      targetId: invitationId,
      ipAddress: ctx.ipAddress,
    });
    return invitation;
  }

  list(ctx: RequestContext) {
    // 一覧はADMIN限定エンドポイント配下（Controller側でRequirePermission）。RLS対象外テーブルだが
    // 一貫性のためctxは受け取っておく（将来Unitスコープ要件が入った場合に備える）。
    void ctx;
    return this.prisma.invitation.findMany({
      include: { employee: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- 招待対象者（未ログイン）操作 ----

  private async findActiveInvitationByToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash } });
    if (!invitation) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '招待リンクが無効です' } });
    }
    if (invitation.status === 'revoked' || invitation.status === 'expired') {
      throw new GoneException({ error: { code: 'GONE', message: '招待リンクが無効です' } });
    }
    if (invitation.expiresAt < new Date()) {
      throw new GoneException({ error: { code: 'GONE', message: '招待リンクの有効期限が切れています' } });
    }
    return invitation;
  }

  async getByToken(rawToken: string) {
    const invitation = await this.findActiveInvitationByToken(rawToken);
    const employee = await this.prisma.withSystemBypass((tx) =>
      tx.employee.findUnique({ where: { id: invitation.employeeId } }),
    );
    if (!employee) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: '招待リンクが無効です' } });
    }

    if (invitation.status === 'pending') {
      await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'opened' } });
    }

    return {
      name: employee.name,
      email: employee.email,
      role: employee.role,
      status: invitation.status,
    };
  }

  async sendOtp(rawToken: string, ipAddress: string | null) {
    const invitation = await this.findActiveInvitationByToken(rawToken);

    // Phase3 16.9節: 招待単位60秒に1回、かつ5回/1時間。
    const cooldown = await this.rateLimiter.checkCooldown(`otp-send:${invitation.id}`, this.config.getOrThrow('OTP_RESEND_COOLDOWN_SECONDS'));
    if (!cooldown.allowed) {
      throw new TooManyRequestsException({
        error: { code: 'RATE_LIMITED', message: '再送信は少し時間をおいてから行ってください', retryAfterSeconds: cooldown.retryAfterSeconds },
      });
    }
    const hourly = await this.rateLimiter.consume(`otp-send-hourly:${invitation.id}`, 3600, 5);
    if (!hourly.allowed) {
      throw new TooManyRequestsException({
        error: { code: 'RATE_LIMITED', message: '送信回数の上限に達しました。しばらくしてから再度お試しください' },
      });
    }

    // 同一invitationの既存activeなOTPを無効化してから新規発行（Phase3 10章）。
    await this.prisma.otpCode.updateMany({
      where: { invitationId: invitation.id, status: 'active' },
      data: { status: 'expired' },
    });

    const otp = generateOtp();
    const codeHash = hashToken(otp);
    const ttlMinutes = this.config.getOrThrow<number>('OTP_TTL_MINUTES');
    const maxAttempts = this.config.getOrThrow<number>('OTP_MAX_ATTEMPTS');

    await this.prisma.otpCode.create({
      data: {
        invitationId: invitation.id,
        codeHash,
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        maxAttempts,
      },
    });

    const employee = await this.prisma.withSystemBypass((tx) =>
      tx.employee.findUnique({ where: { id: invitation.employeeId } }),
    );
    if (employee) {
      // OTPの値自体は本文にのみ含め、どこにもログ出力しない（<constraints>）。
      await this.mail.send(employee.email, '【羅針盤キャリアOS】認証コード', `認証コード: ${otp}（${ttlMinutes}分間有効）`);
    }

    await this.auditLog.record({
      actorEmployeeId: null,
      actorType: 'human',
      action: 'invitation.otp_sent',
      targetType: 'invitation',
      targetId: invitation.id,
      ipAddress,
    });

    return { expiresInMinutes: ttlMinutes };
  }

  async verifyOtp(rawToken: string, code: string, ipAddress: string | null) {
    const invitation = await this.findActiveInvitationByToken(rawToken);

    const otp = await this.prisma.otpCode.findFirst({
      where: { invitationId: invitation.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    const genericError = () =>
      new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: 'コードが正しくありません' } });

    if (!otp) throw genericError();

    if (otp.expiresAt < new Date()) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { status: 'expired' } });
      throw new BadRequestException({
        error: { code: 'OTP_EXPIRED', message: 'コードの有効期限が切れました。再送信してください' },
      });
    }
    if (otp.attemptCount >= otp.maxAttempts) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { status: 'exhausted' } });
      throw new BadRequestException({
        error: { code: 'OTP_EXHAUSTED', message: '試行回数の上限に達しました。再送信してください' },
      });
    }

    const inputHash = hashToken(code);
    const matches = safeCompareHex(inputHash, otp.codeHash);

    if (!matches) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attemptCount: { increment: 1 } } });
      // 残り試行回数はあえて返さない（総当たり探索のヒントを与えない、Phase3 10章）。
      throw genericError();
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { status: 'verified', verifiedAt: new Date() },
    });
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'otp_verified' },
    });
    await this.prisma.withSystemBypass((tx) =>
      tx.employee.update({ where: { id: invitation.employeeId }, data: { invitationStatus: 'otp_verified' } }),
    );

    await this.auditLog.record({
      actorEmployeeId: null,
      actorType: 'human',
      action: 'invitation.otp_verified',
      targetType: 'invitation',
      targetId: invitation.id,
      ipAddress,
    });

    return { verified: true };
  }

  async setPassword(
    rawToken: string,
    password: string,
    passwordConfirmation: string,
    ipAddress: string | null,
    userAgent: string | null,
  ) {
    const invitation = await this.findActiveInvitationByToken(rawToken);
    if (invitation.status !== 'otp_verified') {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: '先にメール認証（OTP）を完了してください' },
      });
    }

    if (password !== passwordConfirmation) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'パスワードが一致しません' },
      });
    }
    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: policy.errors.join(' / ') } });
    }

    const passwordHash = await hashPassword(password);

    const employee = await this.prisma.withSystemBypass((tx) =>
      tx.employee.update({
        where: { id: invitation.employeeId },
        data: {
          passwordHash,
          passwordUpdatedAt: new Date(),
          accountStatus: 'active',
          invitationStatus: 'activated',
        },
      }),
    );
    await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'activated' } });

    await this.auditLog.record({
      actorEmployeeId: employee.id,
      actorType: 'human',
      action: 'invitation.activated',
      targetType: 'employee',
      targetId: employee.id,
      ipAddress,
    });

    // Phase4 13.1節: パスワード設定完了後、ロール別の初回ダッシュボードへ自動遷移する
    // （＝この時点で自動的にログインさせる）。
    const session = await this.sessionService.createSession(employee.id, ipAddress, userAgent);
    return { employee, session };
  }
}
