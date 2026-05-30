# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.18.0-slim

FROM ${NODE_IMAGE} AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV TZ="Asia/Shanghai"
ENV CI="true"

RUN corepack enable

WORKDIR /app

COPY . /app

RUN --mount=type=cache,id=drama-studio-pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

RUN printf '%s\n' \
  'VITE_APP_TITLE=drama-studio' \
  'VITE_APP_NAMESPACE=drama-studio-app' \
  'VITE_APP_STORE_SECURE_KEY=please-replace-me-with-your-own-key' \
  'VITE_BASE=./' \
  'VITE_ROUTER_HISTORY=hash' \
  'VITE_GLOB_API_URL=/api' \
  'VITE_API_BASE_URL=/api' \
  'VITE_COMPRESS=none' \
  'VITE_PWA=false' \
  'VITE_INJECT_APP_LOADING=false' \
  'VITE_ARCHIVER=false' \
  > apps/web/.env.production.local \
  && printf '%s\n' \
  'VITE_APP_TITLE=drama-studio Admin' \
  'VITE_APP_NAMESPACE=drama-studio-admin' \
  'VITE_APP_STORE_SECURE_KEY=please-replace-me-with-your-own-key' \
  'VITE_BASE=/admin/' \
  'VITE_ROUTER_HISTORY=hash' \
  'VITE_GLOB_API_URL=/api' \
  'VITE_COMPRESS=none' \
  'VITE_PWA=false' \
  'VITE_INJECT_APP_LOADING=true' \
  'VITE_ARCHIVER=false' \
  > apps/admin/.env.production.local \
  && pnpm run build:app

FROM ${NODE_IMAGE} AS server

ENV NODE_ENV="prod"
ENV PORT="10588"
ENV TZ="Asia/Shanghai"

WORKDIR /app/apps/server

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=builder /app/apps/server/package.json ./package.json
COPY --from=builder /app/apps/server/node_modules ./node_modules
COPY --from=builder /app/apps/server/data/serve ./serve
COPY --from=builder /app/apps/server/data/serve /opt/drama-studio/server-serve
COPY --from=builder /app/apps/server/data /opt/drama-studio/server-data
COPY docker/server-entrypoint.sh /usr/local/bin/drama-studio-server-entrypoint

RUN rm -rf /opt/drama-studio/server-data/serve \
  && chmod +x /usr/local/bin/drama-studio-server-entrypoint

EXPOSE 10588

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/drama-studio-server-entrypoint"]
CMD ["node", "serve/app.js"]

FROM nginx:stable-alpine AS app

COPY --from=builder /app/apps/web/dist /opt/drama-studio/static/app
COPY --from=builder /app/apps/admin/dist /opt/drama-studio/static/admin
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/app-entrypoint.sh /docker-entrypoint.d/10-init-drama-studio-static.sh

RUN rm -f /etc/nginx/conf.d/default.conf \
  && chmod +x /docker-entrypoint.d/10-init-drama-studio-static.sh

EXPOSE 8080
