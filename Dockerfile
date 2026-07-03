FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

RUN pnpm install --frozen-lockfile

COPY server ./server

ARG APP_VERSION=0.0.0
ARG BUILD_COMMIT=local
ENV NODE_ENV=production
ENV PORT=4000
ENV APP_VERSION=$APP_VERSION
ENV BUILD_COMMIT=$BUILD_COMMIT

EXPOSE 4000

CMD ["sh", "-c", "pnpm --dir server prisma:prod && pnpm --dir server db:prod:push && pnpm --dir server seed:prod && pnpm --dir server start"]
