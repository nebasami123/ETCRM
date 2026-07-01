# Deployment

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for the step-by-step low-hassle path.

The deployment plan is:

- Frontend: Vercel
- Backend API: Dokploy Docker app
- Database: Dokploy Postgres

## 1. Create Dokploy Database

Create a Dokploy Postgres database service and copy its internal connection string.

For hosted Postgres, use `server/prisma/schema.postgres.prisma`. Keep `schema.prisma` for local SQLite development.

## 2. Deploy API on Dokploy

Create a Dokploy application from the GitHub repo and deploy it with the root `Dockerfile`, or pull the prebuilt image from GitHub Container Registry.

- Repository: `nebasami123/ETCRM`
- Branch: `main`
- Dockerfile path: `Dockerfile`
- Published/internal app port: `4000`
- Health check path: `/health`

If the VPS is too small to build Docker images reliably, use the GitHub-built image instead:

- Image: `ghcr.io/nebasami123/etcrm-api:latest`
- Internal app port: `4000`
- Health check path: `/health`

Environment variables:

- `DATABASE_URL`: Dokploy Postgres internal connection string
- `JWT_SECRET`: long random value
- `CLIENT_URL`: Vercel frontend URL
- `ADMIN_NAME`: first production admin name
- `ADMIN_EMAIL`: first production admin email
- `ADMIN_PASSWORD`: first production admin password, minimum 12 characters

The Docker start command generates Prisma Client, pushes the hosted Postgres schema, and starts the API. After the first deploy, open the Dokploy app terminal and seed the production admin:

```bash
pnpm --dir server seed:prod
```

## 3. Deploy Frontend on Vercel

Create a Vercel project from the GitHub repo:

- Root directory: repository root, or `client`
- Build command if root: `pnpm --dir client build`
- Build command if `client`: `pnpm build`
- Output directory if root: `client/dist`
- Output directory if `client`: `dist`

Environment variable:

- `VITE_API_URL=https://your-dokploy-api-domain/api`

Then update Dokploy `CLIENT_URL` to your Vercel URL.

## 4. First Login

Use the admin email/password you provided through `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
