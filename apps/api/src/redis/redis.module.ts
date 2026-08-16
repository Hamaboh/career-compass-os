import { Global, Injectable, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * ioredisはプロセス終了までTCPソケットを保持し続けるため、明示的にOnModuleDestroyで
 * quit()しないとNestの app.close() を呼んでも接続が残る。E2Eテストのjestプロセスが
 * テスト完了後も終了せず「Jest did not exit one second after...」警告が出る原因になっていた
 * （2026-08-16、--detectOpenHandlesでの再現調査により発覚）。
 */
@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

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
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
