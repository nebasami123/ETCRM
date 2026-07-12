# Production cutover checklist

- [ ] Back up existing mock PostgreSQL database.
- [ ] Provision fresh Dokploy PostgreSQL database and configure the private connection string in Dokploy env.
- [ ] Add API secrets and bootstrap-admin env variables (`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`) to Dokploy.
- [ ] Add `VITE_API_URL` and `VITE_AUTH_URL` to Vercel.
- [ ] Add `DOKPLOY_DEPLOY_WEBHOOK` repository secret on GitHub.
- [ ] Push to `main` branch to trigger GitHub Actions build.
- [ ] Wait for Dokploy to roll out the new container (migrations & admin seeding will execute automatically at startup).
- [ ] Verify API health and bootstrap-admin sign-in.
- [ ] Retain the old database only through the rollback window, then decommission it.
