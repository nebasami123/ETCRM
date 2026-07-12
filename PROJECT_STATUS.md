# ETCRM status

Last updated: 2026-07-12

The application is now PostgreSQL-only with Prisma migrations, Better Auth cookie sessions, `ADMIN`/`SALES` roles, transactional lead claims, transfer review, structured activity events, conversion credit, Addis Ababa business-day calculations, server-side duplicate keys, and upload limits.

Local development requires Docker Compose because this workspace does not install or manage a database service itself. Start PostgreSQL on port 5433, apply `pnpm db:migrate`, seed mock accounts with `pnpm seed`, then use `pnpm dev`.

The remaining operational action is the production cutover described in [DEPLOYMENT.md](DEPLOYMENT.md): back up the disposable mock DB, provision a fresh DB, configure the self-hosted runner and secrets, migrate/bootstrap, then point Dokploy at the new database.
