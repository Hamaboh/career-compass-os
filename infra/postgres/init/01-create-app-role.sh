#!/bin/sh
# 羅針盤キャリアOS ― アプリ用ロールの作成（Phase3 17章 Row Level Securityの前提条件）
#
# postgres公式イメージの POSTGRES_USER は常にスーパーユーザーとして作成される
# （postgres本体の初期化要件であり、docker-compose.yml側の設定では変更できない）。
# PostgreSQLの仕様上、スーパーユーザーは FORCE ROW LEVEL SECURITY を設定していても
# 常にRLSをバイパスする（無条件・上書き不可）。そのため、実際にRLSを効かせるアプリ接続用の
# ロールは非スーパーユーザーでなければならない。
#
# このスクリプトは /docker-entrypoint-initdb.d/ に置かれ、postgresコンテナの
# 初回起動時（データディレクトリが空の場合）にのみ自動実行される。
# POSTGRES_USER（= 本スクリプトが動く時点でのスーパーユーザー）とは別に、
# 実際にアプリが接続する非スーパーユーザーロール(APP_DB_USER)をここで作成する。
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE "${APP_DB_USER}" WITH LOGIN PASSWORD '${APP_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    ALTER DATABASE "${POSTGRES_DB}" OWNER TO "${APP_DB_USER}";
    GRANT ALL PRIVILEGES ON DATABASE "${POSTGRES_DB}" TO "${APP_DB_USER}";
EOSQL

# e2eテスト専用DB（career_compass_test）も同時に用意する（test/setup-test-db.shの前提を満たす）。
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE "${POSTGRES_DB}_test" OWNER "${APP_DB_USER}";
EOSQL
