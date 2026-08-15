# Stellaris 部署镜像（monorepo，容器内构建）
# builder：pnpm install（全依赖含 dev）+ workspace 根 typescript；pnpm -r build。
# 各包已有 @types/node devDep，tsc 从包内 @types 解析（无需全局类型）。

# ---------- shared CA bundle ----------
FROM nginx:alpine AS ca_bundle

# ---------- builder ----------
FROM node:24-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# The public prefix is fixed by the Tencent Compose deployment.  Keeping it a
# build argument makes the image usable elsewhere without baking in a host.
ARG VITE_PUBLIC_BASE=/
ENV VITE_PUBLIC_BASE=$VITE_PUBLIC_BASE

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/crawler/package.json ./packages/crawler/
COPY packages/db/package.json ./packages/db/
COPY packages/evidence/package.json ./packages/evidence/
COPY packages/exporter/package.json ./packages/exporter/
COPY packages/rules/package.json ./packages/rules/
COPY packages/agent-runtime/package.json ./packages/agent-runtime/
COPY packages/agent-tools/package.json ./packages/agent-tools/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---------- backend runtime ----------
FROM node:24-slim AS backend
WORKDIR /app
ENV NODE_ENV=production

COPY --from=ca_bundle /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder /app/packages/crawler/dist ./packages/crawler/dist
COPY --from=builder /app/packages/crawler/package.json ./packages/crawler/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/evidence/dist ./packages/evidence/dist
COPY --from=builder /app/packages/evidence/package.json ./packages/evidence/package.json
COPY --from=builder /app/packages/exporter/dist ./packages/exporter/dist
COPY --from=builder /app/packages/exporter/package.json ./packages/exporter/package.json
COPY --from=builder /app/packages/rules/dist ./packages/rules/dist
COPY --from=builder /app/packages/rules/package.json ./packages/rules/package.json
COPY --from=builder /app/packages/agent-runtime/dist ./packages/agent-runtime/dist
COPY --from=builder /app/packages/agent-runtime/package.json ./packages/agent-runtime/package.json
COPY --from=builder /app/packages/agent-tools/dist ./packages/agent-tools/dist
COPY --from=builder /app/packages/agent-tools/package.json ./packages/agent-tools/package.json

# 完整 node_modules（含 .pnpm 存储与各包直接依赖、workspace 链接）。
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=builder /app/packages/crawler/node_modules ./packages/crawler/node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/packages/evidence/node_modules ./packages/evidence/node_modules
COPY --from=builder /app/packages/exporter/node_modules ./packages/exporter/node_modules
COPY --from=builder /app/packages/rules/node_modules ./packages/rules/node_modules
COPY --from=builder /app/packages/agent-runtime/node_modules ./packages/agent-runtime/node_modules
COPY --from=builder /app/packages/agent-tools/node_modules ./packages/agent-tools/node_modules

COPY config/site-adapters ./config/site-adapters
COPY --from=builder /app/third-party ./third-party
COPY --from=builder /app/.pi ./.pi

# R-54：安装 Playwright Chromium（含系统依赖）。浏览器升级 Worker（规格 §10.2）依赖真实浏览器；
# 生产容器此前未装 Chromium，JS 动态地市官网机构列表渲染失败。--with-deps 会 apt-get 安装必要系统库。
RUN sed -i \
      -e 's|http://deb.debian.org/debian-security|https://mirrors.cloud.tencent.com/debian-security|g' \
      -e 's|http://deb.debian.org/debian|https://mirrors.cloud.tencent.com/debian|g' \
      /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

EXPOSE 3000
CMD ["node", "apps/backend/dist/server.js"]

# ---------- web runtime ----------
FROM nginx:alpine AS web
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infra/docker/nginx-web.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
