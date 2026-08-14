import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Redis 7（Phase3 2章）: セッション/レート制限/OTP試行カウンタ/BullMQキューで共用する。
 * Step 0時点ではセッション・レート制限のみ使用。BullMQは実キューが登場するStep 3/4以降で
 * 同じ接続情報から別クライアントを作る。
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>('REDIS_URL')),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
