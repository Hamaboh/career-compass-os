import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';

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
  return app;
}
