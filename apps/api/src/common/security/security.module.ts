import { Global, Module } from '@nestjs/common';
import { RateLimiterService } from './rate-limiter.service';

/**
 * RateLimiterServiceはAuthModule（ログイン試行制限）とInvitationsModule（OTP送信制限）の
 * 両方から必要とされる（PrismaModule/RedisModuleと同様の横断的関心事）ため、Globalモジュールとして
 * 一箇所にまとめる。当初この登録漏れによりe2eテストがDI解決エラーで落ちていた（要修正事項として
 * 完了報告に記載）。
 */
@Global()
@Module({
  providers: [RateLimiterService],
  exports: [RateLimiterService],
})
export class SecurityModule {}
