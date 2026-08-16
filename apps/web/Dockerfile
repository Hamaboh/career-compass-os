# 羅針盤キャリアOS ― Web（Next.js）
# ビルドコンテキストはリポジトリルート（npm workspacesのため）。
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
# scripts/postinstall.js はnpm installのpostinstallフックから参照される
# (package.jsonと同じタイミングでCOPYする必要がある。apps/api/Dockerfileと同じ理由)。
COPY scripts scripts
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY packages/shared packages/shared
COPY apps/web apps/web
# packages/sharedのdist/はnpm install実行時点(まだソース未COPY)では生成できないため、
# apps/webのbuildより先に明示的にビルドする(apps/api/Dockerfileと同じ理由。
# 2026-08-16、この手順が丸ごと欠けていたため web イメージが初回ビルドで
# Cannot find module '@career-compass/shared' 相当のエラーで失敗して発覚)。
RUN npm run build --workspace=packages/shared --if-present
RUN npm run build --workspace=apps/web

FROM node:22-alpine AS runtime
WORKDIR /repo/apps/web
ENV NODE_ENV=production
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/web ./
COPY --from=build /repo/packages/shared /repo/packages/shared
EXPOSE 3000
CMD ["npm", "run", "start"]
