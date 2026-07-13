# Deployment

ETCRM deploys the client to Vercel and the API image to Dokploy. PostgreSQL is the only database in every environment.

Database migrations run automatically inside the API container at startup. Administrator and demo-data seeding are intentional, one-time operations run from the API terminal.

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
   - The Express application itself.
7. **Optional first-time seed**: From the Dokploy API terminal, run `pnpm run seed:prod` once only if you want the configured administrator and demo data. The seed does not clear existing data.
8. **Verification**: Verify `/health`, sign in as the administrator, and then decommission the old database once verified.
