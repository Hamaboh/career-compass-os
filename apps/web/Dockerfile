# 羅針盤キャリアOS ― Web（Next.js）
# ビルドコンテキストはリポジトリルート（npm workspacesのため）。
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace=apps/web

FROM node:22-alpine AS runtime
WORKDIR /repo/apps/web
ENV NODE_ENV=production
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/web ./
COPY --from=build /repo/packages/shared /repo/packages/shared
EXPOSE 3000
CMD ["npm", "run", "start"]
