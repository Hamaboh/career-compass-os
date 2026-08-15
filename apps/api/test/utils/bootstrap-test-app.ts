import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type Redis from 'ioredis';
import { AppModule } from '../../src/app.module';
import { REDIS_CLIENT } from '../../src/redis/redis.module';

/**
 * DB/Redis接続先をdev用（career_compass / db0）からテスト専用（career_compass_test / db1）に
 * 切り替える処理は test/jest-e2e.setup.ts（Jestの`setupFiles`）で行う。
 *
 * 注意: ここ（beforeAll内で呼ばれるこの関数）で`process.env`を上書きしても手遅れ。
 * `ConfigModule.forRoot({ validate })`は`@Module({...})`デコレータの引数として
 * AppModuleのimport時点で同期的に評価されるため、`import { AppModule } from ...`という
 * import文自体が実行された瞬間（＝このファイルがロードされた瞬間）に検証が走ってしまう。
 * setupFilesは各テストファイルのimportグラフより前に実行されるため、これに間に合う。
 */
export async function bootstrapTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (configure) builder = configure(builder);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('v1', { exclude: ['healthz'] });

  await app.init();

  // e2eテストは全てのspecファイルが同一プロセス・同一送信元IPからログインするため、
  // login-ip等のRedisレート制限バケット（本番のブルートフォース対策として意図通り機能する
  // ものであり、しきい値自体は変更しない）が複数specファイルを跨いで累積してしまう。
  // 各specのbeforeAllでこのbootstrapTestApp()を呼ぶタイミングで毎回クリアし、
  // spec間のテスト分離を保証する（アプリ側のレート制限ロジック・しきい値には一切手を入れない）。
  const redis = moduleRef.get<Redis>(REDIS_CLIENT);
  const rateLimitKeys = await redis.keys('ratelimit:*');
  if (rateLimitKeys.length > 0) {
    await redis.del(...rateLimitKeys);
  }

  return app;
}
