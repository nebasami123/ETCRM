# ETCRM

A React + Node CRM with Admin and Sales roles, CSV lead upload, quota tracking, lead notes, and CSV reporting.

## Demo Accounts

- Admin: `admin@etcrm.local` / `password123`
- Sales: `sales@etcrm.local` / `password123`
- Sales: `maria@etcrm.local` / `password123`

## Run Locally

```bash
pnpm install
pnpm --dir server prisma migrate dev --name init
pnpm --dir server seed
pnpm dev
```

Client: http://127.0.0.1:5173  
API: http://127.0.0.1:4000
