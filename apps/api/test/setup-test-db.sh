#!/usr/bin/env bash
# e2eテスト用DB(career_compass_test)の作成とマイグレーション適用。
# Docker Composeのpostgresサービスが起動していることが前提（docker compose up -d postgres）。
set -euo pipefail

CONTAINER="freeksmanagementproject-postgres-1"
DB_USER="app_backend"
DB_NAME="career_compass_test"

EXISTS=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d career_compass -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")

if [ "$EXISTS" != "1" ]; then
  echo "Creating ${DB_NAME}..."
  docker exec "$CONTAINER" psql -U "$DB_USER" -d career_compass -c "CREATE DATABASE ${DB_NAME}"
fi

echo "Applying migrations to ${DB_NAME}..."
cd "$(dirname "$0")/.."
CI=true CHECKPOINT_DISABLE=1 \
  DATABASE_URL="postgresql://app_backend:${POSTGRES_PASSWORD:-change_me_dev_only}@localhost:5432/${DB_NAME}?schema=public" \
  node ../../node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma
