import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Phase3 16.9節「レート制限」。固定ウィンドウ方式のINCR+EXPIRE（Redisのアトミック操作）で実装する。
 * エンドポイント種別ごとに呼び出し側（AuthService/InvitationsService等）が個別の
 * windowSeconds/maxを指定する（16.9節の表に対応する値は各呼び出し箇所のコメントに明記する）。
 */
@Injectable()
export class RateLimiterService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** key単位で固定ウィンドウ内の回数を数える。上限超過ならallowed=falseを返す（消費は行わない）。 */
  async consume(key: string, windowSeconds: number, max: number): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    if (count > max) {
      const ttl = await this.redis.ttl(redisKey);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(ttl, 1) };
    }
    return { allowed: true, remaining: max - count, retryAfterSeconds: 0 };
  }

  /**
   * OTP再送信のような「単発クールダウン」用（Phase3 16.9: 招待単位60秒に1回）。
   * SET NX EX により、ウィンドウ内の最初の1回だけを許可する。
   */
  async checkCooldown(key: string, cooldownSeconds: number): Promise<RateLimitResult> {
    const redisKey = `cooldown:${key}`;
    const set = await this.redis.set(redisKey, '1', 'EX', cooldownSeconds, 'NX');
    if (set === null) {
      const ttl = await this.redis.ttl(redisKey);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(ttl, 1) };
    }
    return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
  }
}
