import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Phase3 1.2/1.3節: 単一プロセスのNestJSアプリケーションサーバー。
 * Auth Module / RBAC Guard / Domain API Modules / AI Orchestration Service を内包する。
 *
 * 認証・RBAC・CSRFミドルウェア等の実装はStep 0以降で追加する（このファイルはStep -1の
 * 起動確認用スケルトンであり、まだ認可は一切かかっていない）。
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1', { exclude: ['healthz'] });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
   
  console.log(`[api] listening on port ${port}`);
}

void bootstrap();
