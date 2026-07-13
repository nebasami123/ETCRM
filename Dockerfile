FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/client/package.json ./apps/client/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

RUN pnpm install --frozen-lockfile

COPY apps/server ./apps/server
COPY packages/contracts ./packages/contracts

RUN pnpm --dir apps/server prisma:generate

ARG APP_VERSION=0.0.0
ARG BUILD_COMMIT=local
ENV NODE_ENV=production
ENV PORT=4000
ENV APP_VERSION=$APP_VERSION
ENV BUILD_COMMIT=$BUILD_COMMIT

EXPOSE 4000

CMD ["pnpm", "--dir", "apps/server", "start"]
