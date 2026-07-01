# ETCRM Deployment Checklist

Recommended low-hassle setup:

- Frontend: Vercel
- Backend: Dokploy Docker app
- Database: Supabase Postgres

## 1. Supabase

1. Create a Supabase project.
2. Open Project Settings > Database.
3. Copy the Postgres connection string.
4. Use the pooled connection string if available.
5. Make sure the URL includes SSL settings.
6. Keep the database password somewhere safe.

The Dokploy backend will use this value as `DATABASE_URL`.

## 2. Dokploy Backend

Create a Dokploy application from the GitHub repo. The root `Dockerfile` defines the backend service.

- Repository: `nebasami123/ETCRM`
- Branch: `main`
- Dockerfile path: `Dockerfile`
- App port: `4000`
- Health check path: `/health`

Environment variables:

- `DATABASE_URL`: Supabase Postgres URL
- `JWT_SECRET`: long random secret
- `CLIENT_URL`: Vercel frontend URL, after frontend deploy
- `ADMIN_NAME`: first production admin name
- `ADMIN_EMAIL`: first production admin email
- `ADMIN_PASSWORD`: first production admin password, minimum 12 characters

The container start command runs Prisma setup automatically:

```bash
pnpm --dir server prisma:prod && pnpm --dir server db:prod:push && pnpm --dir server start
```

After the first deploy, open the Dokploy app terminal and run:

```bash
pnpm --dir server seed:prod
```

## 3. Vercel Frontend

Create a Vercel project from the GitHub repo.

- Repository: `nebasami123/ETCRM`
- Branch: `main`
- Root directory: repository root
- Build command: `pnpm --dir client build`
- Output directory: `client/dist`

Environment variable:

- `VITE_API_URL`: `https://YOUR-DOKPLOY-API-DOMAIN/api`

After Vercel deploys, copy the Vercel URL and set Dokploy `CLIENT_URL` to that URL.

## 4. First Login

Use the admin created by:

```bash
pnpm seed:prod
```

Then create Sales users from the Admin dashboard.

## 5. Notes

- Do not use the demo seed in production.
- Dokploy runs on your server, so uptime and resources depend on that server.
- Supabase free tier is enough for early testing, but watch storage/project limits.
