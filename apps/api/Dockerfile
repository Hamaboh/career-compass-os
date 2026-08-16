# 羅針盤キャリアOS ― API（NestJS）/ Worker 共用イメージ
# ビルドコンテキストはリポジトリルート（npm workspacesのため）。
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
# scripts/postinstall.js はnpm installのpostinstallフックから参照される
# (package.jsonと同じタイミングでCOPYする必要がある。2026-08-16、これを忘れて
# Cannot find module '/repo/scripts/postinstall.js' で失敗して発覚)。
COPY scripts scripts
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY packages/shared packages/shared
COPY apps/api apps/api
# @prisma/clientの型はスキーマファイルから生成される。npm install実行時点ではまだ
# apps/api/prisma/schema.prisma がビルドコンテキストに存在しない(レイヤーキャッシュ効率化のため
# package.jsonだけ先にCOPYしている)ため、npm installのpostinstallで生成される型は空になる
# （2026-08-14, Docker上のnest buildが「Property 'email' does not exist on type '{}'」等
# 56件のエラーで失敗して発覚）。スキーマ本体をCOPYし終えた後に明示的に再生成する。
# 同じ理由でpackages/sharedのdist/も未生成のため、apps/apiのbuildより先に明示的に
# ビルドする(2026-08-16、順序が逆(api→shared)だったためCannot find module
# '@career-compass/shared' でDocker上のnest buildが失敗して発覚)。
RUN npm run build --workspace=packages/shared --if-present
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/packages/shared ./packages/shared
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
