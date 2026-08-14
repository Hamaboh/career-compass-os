/**
 * BullMQワーカーのエントリポイント（Phase3 1.2節）。
 * ReminderScheduler / 進捗再計算 / メール送信キュー / AI非同期分類 をここで処理する。
 *
 * Step -1時点ではプレースホルダー。実際のキュー登録はStep 4（進捗・振り返り・通知）
 * およびStep 3（AI対話）以降、該当ドメインの実装と合わせて追加する。
 *
 * 修正（2026-08-14）: 元々このファイルはconsole.logして即終了する内容だったため、
 * docker-compose.ymlの `restart: unless-stopped` と組み合わさり、コンテナが
 * 起動→即終了→再起動を無限に繰り返すクラッシュループになっていた（実運用12時間で
 * 再起動121回を確認）。BullMQの実キューを登録するまでの間、プロセスを生かしたまま
 * 待機させる（偽の処理をしているように見せない一方で、正常なコンテナ運用は保つ）。
 */
console.log('[worker] placeholder — no queues registered yet (see Step 3/4 in docs/DESIGN_FREEZE.md)');
console.log('[worker] idling to keep the container alive; will be replaced by a real BullMQ worker');

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[worker] received ${signal}, shutting down`);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// 実キューが登録されるまでの暫定的な生存維持。setInterval自体は何もしない。
setInterval(() => {}, 1 << 30);
