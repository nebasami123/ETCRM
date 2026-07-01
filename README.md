# ETCRM

ETCRM is a role-based customer relationship management app for lead intake, assignment, sales follow-up, quota tracking, and operational reporting. It gives administrators a control center for managing sales users and lead data, while sales users get a focused workspace for daily calls, notes, appointments, and pipeline updates.

The project is TypeScript-first across the React client, Express API, Prisma seed scripts, and local helper scripts.

## What The App Does

- Authenticates Admin and Sales users with role-based routing.
- Lets Admin users create sales accounts, import leads, assign leads, manage quotas, review activity, and export reports.
- Lets Sales users view their daily queue, add leads, upload CSV/XLSX lead files, update lead phases, schedule appointments, and record call notes.
- Detects duplicate leads by key contact/business fields during manual creation and imports.
- Tracks activity for important lead and user workflows.
- Supports local SQLite development and a separate Prisma schema for hosted Postgres deployment.

## Tech Stack

| Area | Tools |
| --- | --- |
| Client | React 18, Vite, TypeScript, Tailwind CSS, Recharts, Axios |
| Server | Node.js, Express 5, TypeScript, Prisma, Zod |
| Runtime | `tsx` for running TypeScript server and seed scripts directly |
| Database | SQLite locally, Postgres deployment schema available |
| Imports | CSV and XLSX lead upload support |
| Package manager | pnpm workspaces |

## Repository Layout

```text
ETCRM/
  client/                 React + Vite frontend
  server/                 Express + Prisma API
  docs/                   Cleanup and architecture conventions
  scripts/                Local helper scripts
  package.json            Workspace-level scripts
  pnpm-workspace.yaml     Workspace definition
```

Important backend folders:

```text
server/src/
  app.ts                  Express app setup, CORS, routes, middleware
  server.ts               API entrypoint
  config/db.ts            Prisma client setup
  routes/                 Route registration only
  controllers/            HTTP adapters
  features/
    admin/                Admin queries and commands
    sales/                Sales queries and commands
    auth/                 Auth commands
    leads/                Shared lead services and import workflow
    activity/             Activity logging service
  middleware/             Auth and error middleware
  types/                  Express request augmentation
  utils/                  Pure low-level helpers
```

The backend uses a minimal command/query split. Controllers stay thin: they read request data, validate external input, call a feature query or command, and return the HTTP response. Prisma remains the source of truth for database models.

## Local Development

Install dependencies:

```bash
pnpm install
```

Sync the local SQLite database from the Prisma schema:

```bash
pnpm --dir server prisma db push
```

Seed local development data:

```bash
pnpm seed
```

Run the client and API together:

```bash
pnpm dev
```

Default local URLs:

- Client: http://127.0.0.1:5173
- API: http://127.0.0.1:4000
- Health check: http://127.0.0.1:4000/health

If the default ports are already in use, run each side manually with alternate ports:

```bash
set PORT=4010 && set CLIENT_URL=http://127.0.0.1:5175,http://127.0.0.1:5173 && pnpm --dir server dev
set VITE_API_URL=http://127.0.0.1:4010/api && pnpm --dir client dev --host 127.0.0.1 --port 5175
```

## Environment Variables

Server `.env` values:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-with-a-secure-secret"
PORT=4000
CLIENT_URL="http://127.0.0.1:5173"
```

Client development variable when the API is not on the default port:

```env
VITE_API_URL="http://127.0.0.1:4000/api"
```

Do not commit real production secrets.

## Scripts

Workspace scripts:

```bash
pnpm dev
pnpm build
pnpm seed
pnpm db:migrate
```

Client scripts:

```bash
pnpm --dir client dev
pnpm --dir client build
pnpm --dir client lint
pnpm --dir client lint:fix
```

Server scripts:

```bash
pnpm --dir server dev
pnpm --dir server start
pnpm --dir server typecheck
pnpm --dir server seed
pnpm --dir server seed:prod
pnpm --dir server prisma db push
```

## Database Notes

Local development should use Prisma commands instead of manual SQL:

```bash
pnpm --dir server prisma db push
pnpm --dir server prisma generate
pnpm --dir server seed
```

`server/prisma/schema.prisma` is the local SQLite schema. `server/prisma/schema.postgres.prisma` exists for hosted Postgres deployment while the project keeps separate local and hosted database settings.

SQL files in `server/prisma/` are manual bootstrap or historical migration artifacts. They are not required for normal local development when the Prisma schema is current.

## TypeScript Status

- Client source uses `.ts` and `.tsx`.
- Server source uses `.ts`.
- Prisma seed scripts use TypeScript and run through `tsx`.
- Root build checks client, server, and script TypeScript.
- The server runs TypeScript directly in development and production via `tsx`; no server `dist` build is currently required.

## Verification

Run these before opening or merging a PR:

```bash
pnpm --dir client lint
pnpm --dir client build
pnpm --dir server typecheck
pnpm build
```

Recommended smoke checks:

- Sign in with seeded Admin and Sales users.
- Confirm the Admin dashboard loads summary stats, lead management, quota management, recent activity, imports, and report export.
- Confirm the Sales dashboard loads quota progress, pipeline mix, lead queue, lead detail, phase updates, appointments, notes, manual lead creation, and uploads.
- Confirm `/health` returns `{"status":"ok"}`.

## Documentation

- `docs/client-cleanup-conventions.md`: frontend cleanup conventions
- `docs/server-cleanup-conventions.md`: backend cleanup conventions
- `PROJECT_STATUS.md`: project status and deployment notes
- `DEPLOYMENT.md`: deployment reference
- `DEPLOYMENT_CHECKLIST.md`: deployment checklist
