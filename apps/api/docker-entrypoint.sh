#!/bin/sh
# api/workerコンテナ共通のエントリポイント。
#
# docker-compose.ymlはPhase3 1.2節の「単一マシン構成」を1コマンドで起動する前提だが、
# マイグレーション適用を誰も自動実行しないため、まっさらなDB(新規Codespace/新規clone/
# ボリューム消失後の再起動等)ではテーブルが1つも存在せず、APIが起動はしても
# 全エンドポイントがDBエラーになる状態だった(2026-08-16、GitHub Codespacesでの
# クリーンな初回起動検証で発覚)。api起動前に必ず prisma migrate deploy を通す。
#
# 既に最新まで適用済みの場合は何もせず即座に完了する(冪等)。api/worker両方が
# 同時に起動しても、Prisma migrate deployはアドバイザリロックで直列化されるため安全。
set -e
echo "[entrypoint] applying pending migrations..."
npx prisma migrate deploy --schema=prisma/schema.prisma
echo "[entrypoint] migrations up to date. starting: $*"
exec "$@"
