# ETCRM Project Status

Last updated: 2026-07-02

## Repository

- GitHub: `https://github.com/nebasami123/ETCRM`
- Active branch: `main`
- Local workspace: `C:\Users\Nebas\Documents\ETCRM`

## Current Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: Prisma with local SQLite for development and Dokploy Postgres for production
- Auth: JWT, bcrypt, role-based access control
- Roles: `ADMIN`, `SALES`

## What Is Built

- Login with Admin/Sales routing
- Self-service password change for logged-in users
- Admin dashboard
- Sales dashboard
- CSV/Excel lead upload from Admin
- CSV/Excel lead upload from Sales
- Manual lead creation from Admin
- Manual lead creation from Sales
- Lead assignment/reassignment by Admin
- Lead ownership tracking with `createdBy` and `assignedTo`
- Sales-created/uploaded leads are assigned to that Sales user
- Unassigned `New` lead moved to `Contacted` is claimed by the Sales user who changed it
- Real-estate spreadsheet fields stored as extra lead fields
- Appointment date field
- Appointment dates appear in Sales to-do list
- Lead phase updates
- Call notes with timestamp and agent
- Quota management
- Admin reporting CSV export
- Admin search/filtering by phase, assignment, creator, text
- Sales-side lead search
- Import duplicate detection by phone/license
- Import summary with imported/skipped counts and row-level skip reasons
- Manual lead duplicate prevention by phone/license
- Admin recent activity feed for lead creation/imports, assignment, phase changes, appointments, and notes

## Production Deployment

Current hosted setup:

- Frontend: Vercel
- Frontend URL: `https://www.buanbua.online/login`
- Backend API: Dokploy Docker app
- Backend health URL: `https://api.buanbua.online/health`
- Database: Dokploy Postgres using the internal connection URL
- Container image: `ghcr.io/nebasami123/etcrm-api:latest`

Production configuration that is known to work:

- Vercel root directory: `./`
- Vercel install command: `pnpm install --frozen-lockfile`
- Vercel build command: `pnpm --dir client build`
- Vercel output directory: `client/dist`
- Vercel env: `VITE_API_URL=https://api.buanbua.online/api`
- Dokploy app port: `4000`
- Dokploy domain host: `api.buanbua.online`
- Dokploy domain path/internal path: `/`
- Dokploy HTTPS provider: LetsEncrypt
- Dokploy env `CLIENT_URL=https://www.buanbua.online`

The backend Docker startup generates Prisma Client, pushes the Postgres schema, seeds/upserts the production admin from `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then starts the API. No manual container terminal seed is needed.

## Demo Logins

- Admin: `admin@etcrm.local` / `password123`
- Sales: `sales@etcrm.local` / `password123`
- Sales: `maria@etcrm.local` / `password123`

## Local Run Notes

Install dependencies:

```bash
pnpm install
```

Initialize local SQLite database:

```powershell
$env:DATABASE_URL="file:./dev.db"
.\server\node_modules\.bin\prisma.CMD db execute --schema server/prisma/schema.prisma --file server/prisma/manual-init.sql
pnpm --dir server seed
```

If adding columns to an existing local database, apply the incremental SQL files in `server/prisma/`.

Build frontend:

```powershell
cd client
.\node_modules\.bin\vite.CMD build
```

Start local API and built frontend:

```powershell
pnpm --dir server start
tsx scripts/serve-client.ts
```

URLs:

- Client: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:4000`

## Deployment Plan

Completed:

- Frontend: Vercel
- Backend API: Dokploy Docker app
- Database: Dokploy Postgres
- Checklist: `DEPLOYMENT_CHECKLIST.md`

Production follow-ups:

- Replace `db push` with real migrations after the hosted schema stabilizes
- Add an admin-only create-user screen/API if the current UI does not already expose user creation
- Add richer import preview before committing uploaded rows

## Important Local Notes

- The local database may contain smoke-test leads created during verification.
- Those test rows are local only and are not committed to GitHub.
- Build sometimes needs unsandboxed filesystem access on Windows because Vite/Prisma use generated binaries and symlinked packages.
