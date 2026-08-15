import { BadRequestException, GoneException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { SessionService } from './session.service';
import { RateLimiterService } from '../../common/security/rate-limiter.service';
import { LockedException, TooManyRequestsException } from '../../common/exceptions/http-exceptions';
import { generateOpaqueToken, hashToken } from '../../common/crypto/tokens';
import { hashPassword, verifyPassword } from '../../common/security/password-hash';
import { validatePasswordPolicy } from '../../common/security/password-policy';

/**
 * Phase3 11章「ログインフロー」・16.7節「パスワードリセットフロー」・16.8節「アカウントロック」。
 * ログイン失敗の理由（アカウント不在／パスワード不一致）はレスポンス上区別しない
 * （存在有無を秘匿する、11章の設計どおり）。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mail: MailService,
    private readonly sessionService: SessionService,
    private readonly rateLimiter: RateLimiterService,
    private readonly config: ConfigService,
  ) {}

  private genericAuthError() {
    return new UnauthorizedException({
      error: { code: 'UNAUTHORIZED', message: 'メールアドレスまたはパスワードが正しくありません' },
    });
  }

  async login(email: string, password: string, ipAddress: string | null, userAgent: string | null) {
    const ipLimit = await this.rateLimiter.consume(`login-ip:${ipAddress ?? 'unknown'}`, 900, 20);
    if (!ipLimit.allowed) {
      throw new TooManyRequestsException({
        error: { code: 'RATE_LIMITED', message: 'しばらくしてから再度お試しください' },
      });
    }

    const employee = await this.prisma.withSystemBypass((tx) =>
      tx.employee.findUnique({ where: { email } }),
    );

    if (employee) {
      // Phase3 16.8節: ロックは30分後に自動解除。Step 0時点ではバッチワーカーが未実装のため、
      // ログイン時にunlockAtを過ぎていれば遅延的に解除する（実装済みの簡略化。22章参照）。
      const activeLock = await this.prisma.accountLock.findFirst({
        where: { employeeId: employee.id, unlockedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (activeLock) {
        if (activeLock.unlockAt > new Date()) {
          throw new LockedException({
            error: { code: 'ACCOUNT_LOCKED', message: 'アカウントがロックされています' },
          });
        }
        await this.prisma.accountLock.update({ where: { id: activeLock.id }, data: { unlockedAt: new Date() } });
        await this.prisma.withSystemBypass((tx) =>
          tx.employee.update({ where: { id: employee.id }, data: { accountStatus: 'active' } }),
        );
      }
    }

    const valid =
      employee && employee.accountStatus === 'active' && employee.passwordHash
        ? await verifyPassword(employee.passwordHash, password)
        : false;

    if (!valid) {
      // Phase3 5.A節 login_attempts定義の注記どおり、invalid_password/invalid_emailは
      // レスポンスだけでなくログ(failureReason)でも区別せずinvalid_credentialsに統一する
      // （2026-08-15 セキュリティ監査で、旧実装がnot_found/bad_passwordを別値で保存しており
      // ログ閲覧者にアカウント存在を推測させ得る点がPhase3の明示要件と矛盾すると判明し修正）。
      // account_not_activeのみ、Phase3が明示的に許容する別区分として残す（ロック中/未有効化の
      // 運用監視に必要な情報であり、アカウント存在の推測とは無関係のため）。
      await this.prisma.loginAttempt.create({
        data: {
          employeeId: employee?.id,
          email,
          success: false,
          failureReason: employee && employee.accountStatus !== 'active' ? 'account_not_active' : 'invalid_credentials',
          ipAddress,
        },
      });

      if (employee) {
        // Phase3 16.8節: 15分間で5回連続失敗でロック。閾値-1回までは静かに許容し、閾値到達でロックする。
        const windowSeconds = this.config.getOrThrow<number>('LOGIN_LOCK_WINDOW_MINUTES') * 60;
        const threshold = this.config.getOrThrow<number>('LOGIN_LOCK_THRESHOLD');
        const failLimit = await this.rateLimiter.consume(`login-fail:${employee.id}`, windowSeconds, threshold - 1);
        if (!failLimit.allowed) {
          await this.prisma.accountLock.create({
            data: {
              employeeId: employee.id,
              reason: '15分間で5回のログイン失敗',
              unlockAt: new Date(Date.now() + this.config.getOrThrow<number>('LOGIN_LOCK_DURATION_MINUTES') * 60_000),
            },
          });
          await this.prisma.withSystemBypass((tx) =>
            tx.employee.update({ where: { id: employee.id }, data: { accountStatus: 'locked' } }),
          );
          await this.sessionService.revokeAllSessions(employee.id);
          await this.auditLog.record({
            actorEmployeeId: null,
            actorType: 'system',
            action: 'auth.account_locked',
            targetType: 'employee',
            targetId: employee.id,
            ipAddress,
          });
        }
      }

      throw this.genericAuthError();
    }

    const session = await this.sessionService.createSession(employee!.id, ipAddress, userAgent ?? null);

    await this.prisma.loginAttempt.create({
      data: { employeeId: employee!.id, email, success: true, ipAddress },
    });
    await this.auditLog.record({
      actorEmployeeId: employee!.id,
      actorType: 'human',
      action: 'auth.login',
      targetType: 'employee',
      targetId: employee!.id,
      ipAddress,
    });

    return { employee: employee!, session };
  }

  async logout(tokenHash: string, employeeId: string, ipAddress: string | null) {
    await this.sessionService.revokeSession(tokenHash);
    await this.auditLog.record({
      actorEmployeeId: employeeId,
      actorType: 'human',
      action: 'auth.logout',
      targetType: 'employee',
      targetId: employeeId,
      ipAddress,
    });
  }

  async requestPasswordReset(email: string, ipAddress: string | null) {
    const emailLimit = await this.rateLimiter.consume(`pwreset-email:${email}`, 3600, 3);
    const ipLimit = await this.rateLimiter.consume(`pwreset-ip:${ipAddress ?? 'unknown'}`, 3600, 20);
    // 上限超過時も「メールをご確認ください」と同一のレスポンスを返す（アカウント存在の推測防止、16.7節）。
    if (emailLimit.allowed && ipLimit.allowed) {
      const employee = await this.prisma.withSystemBypass((tx) => tx.employee.findUnique({ where: { email } }));
      if (employee && employee.accountStatus === 'active') {
        await this.prisma.passwordResetToken.updateMany({
          where: { employeeId: employee.id, usedAt: null },
          data: { expiresAt: new Date() },
        });
        const rawToken = generateOpaqueToken();
        const tokenHash = hashToken(rawToken);
        const ttlMinutes = this.config.getOrThrow<number>('PASSWORD_RESET_TOKEN_TTL_MINUTES');
        await this.prisma.passwordResetToken.create({
          data: { employeeId: employee.id, tokenHash, expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
        });
        await this.mail.send(
          employee.email,
          '【羅針盤キャリアOS】パスワード再設定',
          `以下のリンクからパスワードを再設定してください（${ttlMinutes}分間有効）:\nhttps://localhost/password-reset/${rawToken}`,
        );
        await this.auditLog.record({
          actorEmployeeId: employee.id,
          actorType: 'human',
          action: 'auth.password_reset_requested',
          targetType: 'employee',
          targetId: employee.id,
          ipAddress,
        });
      }
    }
    return { message: 'パスワード再設定の案内をメール送信しました（該当する場合）' };
  }

  async confirmPasswordReset(rawToken: string, password: string, passwordConfirmation: string, ipAddress: string | null) {
    const tokenHash = hashToken(rawToken);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new GoneException({
        error: { code: 'GONE', message: 'リンクが無効または期限切れです' },
      });
    }
    if (password !== passwordConfirmation) {
      throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: 'パスワードが一致しません' } });
    }
    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: policy.errors.join(' / ') } });
    }

    const passwordHash = await hashPassword(password);
    await this.prisma.withSystemBypass((tx) =>
      tx.employee.update({
        where: { id: resetToken.employeeId },
        data: { passwordHash, passwordUpdatedAt: new Date() },
      }),
    );
    await this.prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } });
    await this.sessionService.revokeAllSessions(resetToken.employeeId);

    await this.auditLog.record({
      actorEmployeeId: resetToken.employeeId,
      actorType: 'human',
      action: 'auth.password_reset',
      targetType: 'employee',
      targetId: resetToken.employeeId,
      ipAddress,
    });

    return { message: 'パスワードを再設定しました。再度ログインしてください' };
  }

  /**
   * MEM-16(プロフィール)「パスワード変更」。Phase3 12章のポリシーをリセット/招待時と同一に適用し、
   * 16.6節どおり変更元セッション以外を全失効させる。2026-08-15、フロントエンド実装時に本機能が
   * 未実装であること（忘れた場合のリセットのみ存在）に気づき追加した。
   */
  async changePassword(
    employeeId: string,
    currentPassword: string,
    newPassword: string,
    newPasswordConfirmation: string,
    currentSessionTokenHash: string,
    ipAddress: string | null,
  ) {
    const employee = await this.prisma.withSystemBypass((tx) => tx.employee.findUnique({ where: { id: employeeId } }));
    if (!employee || !employee.passwordHash || !(await verifyPassword(employee.passwordHash, currentPassword))) {
      throw new UnauthorizedException({ error: { code: 'UNAUTHORIZED', message: '現在のパスワードが正しくありません' } });
    }
    if (newPassword !== newPasswordConfirmation) {
      throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: 'パスワードが一致しません' } });
    }
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: policy.errors.join(' / ') } });
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.withSystemBypass((tx) =>
      tx.employee.update({ where: { id: employeeId }, data: { passwordHash, passwordUpdatedAt: new Date() } }),
    );
    await this.sessionService.revokeAllSessionsExcept(employeeId, currentSessionTokenHash);

    await this.auditLog.record({
      actorEmployeeId: employeeId,
      actorType: 'human',
      action: 'employee.password_change',
      targetType: 'employee',
      targetId: employeeId,
      // Phase3 15.2節: パスワード変更イベント自体は記録するが値は含めない(before/afterは常にNULL)。
      before: null,
      after: null,
      ipAddress,
    });

    return { message: 'パスワードを変更しました' };
  }
}
