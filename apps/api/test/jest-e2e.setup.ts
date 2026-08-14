/**
 * Jestの `setupFiles`（setupFilesAfterEnvではない）はテストフレームワーク導入前・
 * 各テストファイルのimportグラフが評価される前に実行される。
 *
 * `@nestjs/config`の`ConfigModule.forRoot({ validate })`は`@Module({...})`デコレータの
 * 引数として**AppModuleのimport時に同期的に**評価される。つまり `beforeAll()` の中で
 * `process.env`を上書きしても、その時点では既に`AppModule`のimportチェーン経由で
 * `ConfigModule.forRoot()`の検証が完了してしまっており手遅れ。この検証は全ての必須環境変数
 * (env.validation.ts参照)を要求するため、ここで.env.exampleと同じ値一式を明示的に設定する
 * （DB/Redisの接続先のみdev用からテスト専用に差し替える）。
 */
process.env.NODE_ENV = 'test';

// テスト専用のDB/Redis（career_compass_test / RedisのDB index 1）。dev用のデータと分離する。
process.env.DATABASE_URL =
  'postgresql://app_backend:change_me_dev_only@localhost:5432/career_compass_test?schema=public';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// 以下は.env.exampleと同じ既定値（DB/Redis以外はdevと同じ設定でテストする）。
process.env.SESSION_COOKIE_NAME = '__Host-session';
process.env.SESSION_TTL_HOURS = '8';
process.env.CSRF_COOKIE_NAME = 'csrf_token';
process.env.INVITATION_TOKEN_TTL_HOURS = '72';
process.env.OTP_TTL_MINUTES = '10';
process.env.OTP_MAX_ATTEMPTS = '5';
process.env.OTP_RESEND_COOLDOWN_SECONDS = '60';
process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES = '30';
process.env.LOGIN_LOCK_THRESHOLD = '5';
process.env.LOGIN_LOCK_WINDOW_MINUTES = '15';
process.env.LOGIN_LOCK_DURATION_MINUTES = '30';
