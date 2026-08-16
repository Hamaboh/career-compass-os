#!/usr/bin/env node
// ルートpackage.jsonのpostinstallから呼ばれる。
//
// npm install直後にpackages/sharedのビルド(dist/生成)とPrisma Client生成を
// 自動実行し、初回clone/Codespaces起動時にCI(#5efaa2b)で発覚した
// 「Cannot find module '@career-compass/shared'」を再発させないためのもの。
//
// ただし apps/api・apps/web の各Dockerfileは、ビルドキャッシュ効率化のため
// 「package.jsonだけCOPY→npm install→ソース本体をCOPY→明示的にbuild」という
// 2段階構成を意図的に採っている(Dockerfile内コメント参照)。この場合、npm install
// 実行時点ではpackages/shared/tsconfig.build.jsonやapps/api/prisma/schema.prisma
// がまだビルドコンテキストに存在しないため、素朴にbuild/generateを呼ぶと
// 「path does not exist」等で失敗する(2026-08-16、Docker web/workerイメージの
// 初回ビルドで発覚)。Dockerfile側は後続レイヤーで同じコマンドを明示的に実行するため、
// ソースが揃っていない場合は黙ってスキップしてよい。
const { execSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

const sharedTsconfig = path.join(__dirname, '..', 'packages', 'shared', 'tsconfig.build.json');
const apiSchema = path.join(__dirname, '..', 'apps', 'api', 'prisma', 'schema.prisma');

if (existsSync(sharedTsconfig)) {
  run('npm run build --workspace=packages/shared');
} else {
  console.log('[postinstall] packages/shared/tsconfig.build.json が未配置のためビルドをスキップ(Docker多段ビルド中と判断)');
}

if (existsSync(apiSchema)) {
  run('npm run prisma:generate --workspace=apps/api');
} else {
  console.log('[postinstall] apps/api/prisma/schema.prisma が未配置のためPrisma Client生成をスキップ(Docker多段ビルド中と判断)');
}
