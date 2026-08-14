import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { PrismaService } from '../../prisma/prisma.service';
import { generateOpaqueToken, hashToken } from '../../common/crypto/tokens';
import type { EmployeeRole } from '@career-compass/shared';

interface SessionPayload {
  employeeId: string;
}

export interface ValidatedSession {
  employeeId: string;
  role: EmployeeRole;
  unitId: string | null;
  tokenHash: string;
}

/**
 * Phase3 16.1節: セッションの生存状態はRedisが正、DBの`sessions`テーブルは監査用の補助台帳。
 * TTLは固定8時間（スライディング延長はしない）。
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.config.getOrThrow<number>('SESSION_TTL_HOURS') * 3600;
  }

  async createSession(
    employeeId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const ttl = this.ttlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const payload: SessionPayload = { employeeId };
    await this.redis.set(`session:${tokenHash}`, JSON.stringify(payload), 'EX', ttl);
    await this.redis.sadd(`user_sessions:${employeeId}`, tokenHash);
    // user_sessions setは個々のメンバー(tokenHash)がTTL切れになっても自動では縮まないため、
    // set自体にも同じTTLを設定し直して際限なく肥大化しないようにする（軽量な運用対策）。
    await this.redis.expire(`user_sessions:${employeeId}`, ttl);

    await this.prisma.session.create({
      data: { employeeId, tokenHash, expiresAt, ipAddress, userAgent },
    });

    return { rawToken, expiresAt };
  }

  /**
   * Redisのセッションを検証したうえで、現在のrole/unitId/accountStatusをemployeesテーブルから
   * 取得する（キャッシュされた古いroleを使わないことで、権限変更やアカウント状態変更が
   * 次のリクエストから即座に反映されるようにする）。employees_self_select RLSポリシーは
   * role設定に関わらず「自分自身の行」を常に返すため、ここでは仮のroleでRLSコンテキストを組む。
   */
  async validateSession(rawToken: string): Promise<ValidatedSession | null> {
    const tokenHash = hashToken(rawToken);
    const raw = await this.redis.get(`session:${tokenHash}`);
    if (!raw) return null;

    const { employeeId } = JSON.parse(raw) as SessionPayload;

    const employee = await this.prisma.withRlsContext(
      { employeeId, role: 'MEMBER', unitId: null, ipAddress: null },
      (tx) => tx.employee.findUnique({ where: { id: employeeId } }),
    );
    if (!employee || employee.accountStatus !== 'active') {
      // アカウント状態が変わっていた場合は即座に無効扱いにする（Phase3 16.6節の趣旨）。
      return null;
    }

    return { employeeId, role: employee.role, unitId: employee.unitId, tokenHash };
  }

  async revokeSession(tokenHash: string): Promise<void> {
    const raw = await this.redis.get(`session:${tokenHash}`);
    if (raw) {
      const { employeeId } = JSON.parse(raw) as SessionPayload;
      await this.redis.srem(`user_sessions:${employeeId}`, tokenHash);
    }
    await this.redis.del(`session:${tokenHash}`);
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Phase3 16.6節: パスワード変更・リセット・アカウント状態変更等で全セッションを即時失効させる。 */
  async revokeAllSessions(employeeId: string): Promise<void> {
    const hashes = await this.redis.smembers(`user_sessions:${employeeId}`);
    if (hashes.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const h of hashes) pipeline.del(`session:${h}`);
      pipeline.del(`user_sessions:${employeeId}`);
      await pipeline.exec();
    }
    await this.prisma.session.updateMany({
      where: { employeeId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
