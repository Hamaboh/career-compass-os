import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

/**
 * Phase3 1.2/1.3節: 単一プロセスのNestJSアプリケーションサーバー。
 * Auth Module / RBAC Guard / Domain API Modules / AI Orchestration Service を内包する。
 * Step 0で認証・RBAC・CSRF・監査ログの実装を追加した。
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Caddyの背後で動くため、X-Forwarded-*ヘッダを信頼してクライアントIPを正しく解決する
  // （login/OTP/レート制限・監査ログのipAddressに使う）。
  app.set('trust proxy', 1);

  app.use(cookieParser());

  // Phase3 13.1節: 全APIの入力はDTOでホワイトリスト検証する（想定外フィールドは拒否）。
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // infra/caddy/Caddyfile は `handle_path /api/*` で `/api` セグメントを剥がしてから
  // このプロセスへ転送する（Caddyfileの変更に合わせた対応、2026-08-14）。
  // クライアントから見えるベースパスは引き続き Phase3 13.1節どおり `/api/v1/` のまま
  // （Caddy側で `/api` を付け外ししているだけで、NestJS内部では `v1` のみで受ける）。
  app.setGlobalPrefix('v1', { exclude: ['healthz'] });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`[api] listening on port ${port}`);
}

void bootstrap();
