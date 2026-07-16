# ETCRM

ETCRM is a React + Express CRM for collaborative sales teams. It uses one PostgreSQL schema in every environment, Better Auth cookie sessions, and an auditable lead timeline.

## Local setup

Prerequisites: Node 22+, pnpm 11+, and Docker Desktop (or another Compose-compatible Docker engine).

```powershell
pnpm install
Copy-Item apps\server\.env.example apps\server\.env
Copy-Item apps\client\.env.example apps\client\.env
docker compose up -d
pnpm db:migrate
pnpm seed
pnpm dev
```

The Compose database is PostgreSQL 18 on `127.0.0.1:5433`; it creates isolated `etcrm_dev`, `etcrm_shadow`, and `etcrm_test` databases. Do not use `prisma db push` for this project.

Local URLs:

- Client: `http://127.0.0.1:5173`
- API health: `http://127.0.0.1:4000/health`

Demo seed accounts: `admin@etcrm.local`, `sales@etcrm.local`, and `maria@etcrm.local`; each has password `password123`. These accounts are development-only.

## Environment

`apps/server/.env` must provide:

```env
DATABASE_URL="postgresql://etcrm:etcrm@127.0.0.1:5433/etcrm_dev?schema=public"
SHADOW_DATABASE_URL="postgresql://etcrm:etcrm@127.0.0.1:5433/etcrm_shadow?schema=public"
TEST_DATABASE_URL="postgresql://etcrm:etcrm@127.0.0.1:5433/etcrm_test?schema=public"
BETTER_AUTH_SECRET="at-least-32-random-characters-long"
BETTER_AUTH_URL="http://127.0.0.1:4000"
CLIENT_URL="http://127.0.0.1:5173"
BUSINESS_TIME_ZONE="Africa/Addis_Ababa"
UPLOAD_MAX_BYTES=10485760
UPLOAD_MAX_ROWS=10000
```

Set `VITE_API_URL` and `VITE_AUTH_URL` in `apps/client/.env`. See the committed example files for the full list.

## Database workflow

`apps/server/prisma/schema.prisma` and the committed `apps/server/prisma/migrations/` are canonical.

```powershell
pnpm db:migrate                      # local development: prisma migrate dev
pnpm --dir apps/server migrate:deploy # production/CI only: prisma migrate deploy
pnpm db:reset                        # reset local development DB
```

Production migrations run automatically inside the API container at app startup. During rollout, the container runs `prisma migrate deploy` followed by the idempotent bootstrap-admin command before starting the Express server.

## Architecture

- `apps/server/src/auth`: Better Auth and Prisma PostgreSQL adapter.
- `apps/server/src/features/leads/leadWorkflowService.ts`: transactional lead creation/import, atomic claim, transfer, timeline, phase, and schedule mechanics.
- `apps/server/src/features/admin` and `apps/server/src/features/sales`: role-specific policies and queries over the shared workflow.
- `ActivityEvent`: immutable activity timeline; it records actor, phase transitions, notes, and optional conversion credit.

Claims prevent races for an unclaimed lead. Sales users can still collaborate and record work on an already-claimed lead; the UI identifies the current claimer and every action remains attributable. Only an admin selects conversion credit on `CLOSED_WON`.

## Verification

```powershell
pnpm test
pnpm build
```

Before a production cutover, back up the old mock database, create a fresh Dokploy PostgreSQL database, set the new URLs/secrets, trigger the deployment build, verify health and bootstrap-admin login, then verify the Dokploy application is running successfully. Retain the old DB only as the rollback snapshot.
