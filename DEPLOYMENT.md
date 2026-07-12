# Deployment

ETCRM deploys the client to Vercel and the API image to Dokploy. PostgreSQL is the only database in every environment.

Unlike previous versions, database migrations and administrator bootstrapping run **automatically inside the API container at app startup**. This removes the need for a self-hosted CI runner with direct database access.

## Deployment Steps

1. **Database Setup**: Back up the current Dokploy database and provision a new empty PostgreSQL database.
2. **Configure API on Dokploy**: Configure the Dokploy API application with the required environment variables:
   - `DATABASE_URL`: Connection string to your production database.
   - `BETTER_AUTH_SECRET`: A secure key (at least 32 random characters).
   - `BETTER_AUTH_URL`: The public URL of your backend.
   - `CLIENT_URL`: The public URL of your frontend.
   - `BUSINESS_TIME_ZONE`: e.g. `Africa/Addis_Ababa`.
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: Used to bootstrap the admin account on startup.
3. **Configure Vercel**: Configure Vercel with:
   - `VITE_API_URL=https://YOUR_API/api`
   - `VITE_AUTH_URL=https://YOUR_API`
4. **Configure GitHub Secrets**: Set `DOKPLOY_DEPLOY_WEBHOOK` as a repository secret in GitHub.
5. **Push to `main`**: A standard GitHub-hosted runner (`ubuntu-latest`) runs unit tests, builds the production Docker image, pushes it to GitHub Container Registry, and triggers the Dokploy rollout.
6. **Container Startup**: When Dokploy spins up the container, it automatically runs:
   - `prisma migrate deploy` to update the database schema.
   - `tsx prisma/seed-production.ts` to bootstrap the admin account (idempotent).
   - The Express application itself.
7. **Verification**: Verify `/health`, sign in as the bootstrap admin, and then decommission the old database once verified.
