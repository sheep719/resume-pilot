FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmmirror.com --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
# standalone 模式下 rewrites 的 destination 是构建时固化进 routes-manifest 的，
# 所以 BACKEND_URL 必须通过 build arg 传入（docker-compose 的 environment 进不了构建阶段）。
# 本地开发默认 127.0.0.1:8000；云上 compose 传 http://backend:8000（容器互联 DNS）
ARG BACKEND_URL=http://127.0.0.1:8000
# build 内存上限：Next build 峰值轻松 1.5G+，小内存服务器上必须压住堆（宁可慢，不能 OOM）
ENV NEXT_TELEMETRY_DISABLED=1 BACKEND_URL=$BACKEND_URL NODE_OPTIONS=--max-old-space-size=1024
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# HOSTNAME=0.0.0.0：standalone server.js 默认只绑 localhost，容器外不可达
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
