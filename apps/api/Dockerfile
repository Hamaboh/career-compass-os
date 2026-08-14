# 羅針盤キャリアOS ― API（NestJS）/ Worker 共用イメージ
# ビルドコンテキストはリポジトリルート（npm workspacesのため）。
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace=apps/api
RUN npm run build --workspace=packages/shared --if-present

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
