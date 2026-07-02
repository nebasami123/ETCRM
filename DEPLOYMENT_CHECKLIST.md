# ETCRM Deployment Checklist

Recommended low-hassle setup:

- Frontend: Vercel
- Backend: Dokploy Docker app
- Database: Dokploy Postgres

## 1. Dokploy Postgres

1. Create a Dokploy Postgres database service.
2. Use database name `etcrm`.
3. Use user `etcrm`.
4. Generate and save a strong password.
5. Copy the internal connection string.
6. Do not expose Postgres publicly unless you need external database access.

The Dokploy backend will use this value as `DATABASE_URL`.

## 2. Dokploy Backend

Create a Dokploy application from the GitHub repo. The root `Dockerfile` defines the backend service. For low-RAM VPS servers, prefer the GitHub-built image.

- Repository: `nebasami123/ETCRM`
- Branch: `main`
- Dockerfile path: `Dockerfile`
- App port: `4000`
- Health check path: `/health`

Prebuilt image option:

- Provider/build type: Docker image
- Image: `ghcr.io/nebasami123/etcrm-api:latest`
- App port: `4000`
- Health check path: `/health`

Environment variables:

- `DATABASE_URL`: Dokploy Postgres internal connection string
- `JWT_SECRET`: long random secret
- `CLIENT_URL`: Vercel frontend URL, after frontend deploy
- `ADMIN_NAME`: first production admin name
- `ADMIN_EMAIL`: first production admin email
- `ADMIN_PASSWORD`: first production admin password, minimum 12 characters

The container start command runs Prisma setup automatically:

```bash
pnpm --dir server prisma:prod && pnpm --dir server db:prod:push && pnpm --dir server seed:prod && pnpm --dir server start
```

No manual production seed command is needed in the Dokploy terminal.

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

Use the admin email/password you provided through `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

Then create Sales users from the Admin dashboard.

## 5. Notes

- Do not use the demo seed in production.
- Dokploy runs on your server, so uptime and resources depend on that server.
- Make sure the Dokploy database has persistent storage/backups enabled before using it for real production data.
