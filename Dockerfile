# syntax=docker/dockerfile:1.4

####################################################################################################
## Build Packages

FROM node:22-alpine AS builder
WORKDIR /directus

ENV NODE_OPTIONS=--max-old-space-size=8192
ENV CI=true

COPY package.json .
RUN corepack enable && corepack prepare

COPY pnpm-lock.yaml .
RUN pnpm fetch
COPY . .
RUN pnpm install --recursive --offline --frozen-lockfile

RUN : \
	&& npm_config_workspace_concurrency=1 pnpm run build \
	&& pnpm --filter @wbce-d9/directus9 deploy --prod dist \
	&& cd dist \
	&& pnpm pack \
	&& tar -zxvf *.tgz package/package.json \
	&& mv package/package.json package.json \
	&& rm -r *.tgz package \
	&& mkdir -p database extensions uploads \
	;

####################################################################################################
## Create Production Image

FROM node:22-alpine AS runtime

USER node

WORKDIR /directus

EXPOSE 8055

ENV \
	DB_CLIENT="pg" \
	DB_HOST="postgres" \
	DB_PORT="5432" \
	DB_DATABASE="d9" \
	DB_USER="d9" \
	DB_PASSWORD="d9" \
	CACHE_ENABLED="true" \
	CACHE_STORE="redis" \
	CACHE_REDIS="redis://redis:6379" \
	EXTENSIONS_PATH="/directus/extensions" \
	STORAGE_LOCAL_ROOT="/directus/uploads" \
	NODE_ENV="production" \
	NPM_CONFIG_UPDATE_NOTIFIER="false"

COPY --from=builder --chown=node:node /directus/dist .
COPY --chown=node:node docker-entrypoint.sh /directus/docker-entrypoint.sh

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8055/server/health || exit 1

CMD ["sh", "/directus/docker-entrypoint.sh"]
