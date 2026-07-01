FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

RUN pnpm install --frozen-lockfile

COPY server ./server

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["sh", "-c", "pnpm --dir server prisma:prod && pnpm --dir server db:prod:push && pnpm --dir server start"]
