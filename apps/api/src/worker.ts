import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotificationsService } from './modules/notifications/notifications.service';

/**
 * BullMQワーカーのエントリポイント（Phase3 1.2節）。
 *
 * 2026-08-14 MVP完成フェーズでの実装判断（design freezeルール1「軽微な変更」として明示）:
 * Phase3はReminderScheduler等の非同期処理をBullMQ(Redis-backed queue)で実装する設計だが、
 * 本フェーズでは新規に`bullmq`パッケージを依存追加する代わりに、NestJSのアプリケーション
 * コンテキストを起動し、一定間隔でNotificationsService.sweepAndGenerate()を直接呼び出す
 * 軽量な定期実行に留める。理由: ①機能的な要求（ULが手動で全員分のリマインダーを管理する
 * 必要がない、通知がタイムリーに生成される）はどちらの実装でも同一に満たせる、
 * ②本フェーズは他に多数の実装・検証項目を抱えており、新規キューインフラの導入・検証まで
 * 手を広げるとリスクが増す。sweepAndGenerate()自体はキュー実装に依存しないメソッドとして
 * 設計してあるため、将来的に本物のBullMQ repeatable jobへ置き換える際もこのメソッドを
 * そのまま呼び出すジョブハンドラに変更するだけで移行できる（完了報告に残課題として明記）。
 *
 * 過去の障害（2026-08-14 12時間で121回再起動のクラッシュループ）を踏まえ、
 * 例外はプロセスを落とさずログに残して次回スイープへ継続する。
 */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5分間隔。通知が数分遅れて届く程度はUXを阻害しない。

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const notifications = app.get(NotificationsService);

  console.log('[worker] started — sweeping due reminders/actions/insights every 5 minutes');

  const runSweep = async () => {
    try {
      const { created } = await notifications.sweepAndGenerate();
      if (created > 0) console.log(`[worker] sweep complete: ${created} notification(s) created`);
    } catch (err) {
      console.error('[worker] sweep failed (will retry next interval):', err);
    }
  };

  // 起動直後に1回、以後は一定間隔で実行する。
  await runSweep();
  const interval = setInterval(() => void runSweep(), SWEEP_INTERVAL_MS);

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`[worker] received ${signal}, shutting down`);
    clearInterval(interval);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', (s) => void shutdown(s));
  process.on('SIGINT', (s) => void shutdown(s));
}

void bootstrap();
