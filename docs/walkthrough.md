# ETCRM — Full Application Walkthrough

## What is ETCRM?

ETCRM is a CRM (Customer Relationship Management) system built for a sales-driven organization. It manages leads through a sales pipeline, tracks agent performance, handles daily quotas, and generates activity reports. The system has two roles: **Admin** (management) and **Sales** (agents).

---

## Architecture Overview

```
etcrm/
├── apps/
│   ├── client/          ← React frontend (Vite + TypeScript)
│   └── server/          ← Express backend (TypeScript + Prisma)
├── packages/
│   └── contracts/       ← Shared validation schemas (Zod)
├── docs/                ← Documentation
└── package.json         ← Root workspace (pnpm monorepo)
```

**Tech Stack:**
- **Frontend:** React 19, Vite, React Router v6, Tailwind CSS v4, Recharts, Lucide icons
- **Backend:** Express, Prisma ORM (PostgreSQL), Better Auth, Zod validation
- **Tooling:** pnpm workspaces, TypeScript, concurrently

---

## Authentication & Authorization

**Auth provider:** [Better Auth](https://www.better-auth.com/) — handles sessions, sign-in, password changes.

**Flow:**
1. User opens `/login` → sees the `LoginPage` component
2. On submit, `authClient.signIn.email()` is called → sends credentials to `POST /api/auth/sign-in/email`
3. On success, `AuthProvider` stores the user in React state + context
4. `ProtectedRoute` wraps all dashboard routes — checks `loading` → `isAuthenticated` → `user.role`
5. If role doesn't match the route, redirects to the correct dashboard (`/admin` or `/sales`)
6. Session is validated on app mount via `authClient.getSession()`

**Roles:**
| Role | Access |
|------|--------|
| `ADMIN` | `/admin/*` — full management access |
| `SALES` | `/sales/*` — limited to own leads and pipeline |

**Server-side auth middleware (`apps/server/src/middleware/auth.ts`):**
- `requireAuth` — validates the session token from cookies, attaches `req.user`
- `requireRole("ADMIN")` — blocks non-admin users with 403

---

## Data Model (Prisma Schema)

### Core Entities

```
User ──< Lead (createdBy, claimedBy)
User ──< ActivityEvent (actor, creditedUser)
User ──< Quota
Lead ──< ActivityEvent
Lead ──< ClaimTransferRequest
```

**Lead** — the central entity. Represents a potential customer/contact.

| Field | Purpose |
|-------|---------|
| `phase` | Pipeline stage: NEW → CONTACTED → FOLLOW_UP → CLOSED_WON / CLOSED_LOST |
| `claimedById` | Which sales agent owns this lead |
| `claimedAt` | When the lead was claimed |
| `createdById` | Who created/registered the lead |
| `appointmentDate` | Scheduled meeting |
| `nextFollowUpAt` | Follow-up reminder |
| `phoneKey` | Normalized phone (digits only, unique) |
| `licenceKey` | Normalized license number (unique) |

**ActivityEvent** — audit trail for every action in the system.

| Field | Purpose |
|-------|---------|
| `type` | What happened (LEAD_CREATED, LEAD_CLAIMED, CALL_NOTE, PHASE_CHANGED, etc.) |
| `actorId` | Who performed the action |
| `creditedUserId` | Who gets conversion credit (only for CLOSED_WON) |
| `fromPhase` / `toPhase` | Phase transition details |
| `note` | Call note content (for CALL_NOTE events) |
| `metadata` | JSON payload for context (import details, transfer info, etc.) |

**Quota** — daily targets per sales agent.

| Field | Purpose |
|-------|---------|
| `salesUserId` | The agent |
| `date` | Business date |
| `callsTarget` | How many calls to make |
| `leadsTarget` | How many leads to process |

**ClaimTransferRequest** — when one agent wants to take a lead from another.

---

## Lead Lifecycle

```
                    ┌──────────────┐
                    │     NEW      │ ← Created by admin or sales
                    └──────┬───────┘
                           │ claimed
                    ┌──────▼───────┐
                    │  CONTACTED   │ ← Sales agent makes first contact
                    └──────┬───────┘
                           │ follow-up needed
                    ┌──────▼───────┐
                    │  FOLLOW_UP   │ ← Scheduled for later
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────▼───────┐         ┌──────▼───────┐
       │  CLOSED_WON  │         │  CLOSED_LOST │
       └──────────────┘         └──────────────┘
```

**Key rules:**
- **Only admins** can close a lead as `CLOSED_WON` (sales agents are blocked)
- When closing as won, admin **must specify** a `creditedUserId` (which agent gets the conversion credit)
- This allows admins to reassign credit to agents who didn't claim the lead
- Sales agents can move leads to CONTACTED, FOLLOW_UP, or CLOSED_LOST
- All phase changes are logged as `ActivityEvent` records

---

## Server API Routes

### Auth Routes (Better Auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/sign-in/email` | Email + password login |
| POST | `/api/auth/sign-out` | Logout |
| GET | `/api/auth/get-session` | Get current session |
| POST | `/api/auth/change-password` | Change password |

### Admin Routes (`/api/admin/*`) — requires ADMIN role
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/summary` | KPI summary (total leads, won, lost, etc.) |
| GET | `/admin/leaderboard` | Per-agent conversion stats + rankings |
| GET | `/admin/leads` | List all leads (with filters + pagination) |
| POST | `/admin/leads` | Create a lead |
| POST | `/admin/leads/upload` | Bulk import leads from CSV/Excel |
| PATCH | `/admin/leads/:id/assign` | Assign/unassign a lead to an agent |
| PATCH | `/admin/leads/:id/phase` | Change phase + set conversion credit |
| GET | `/admin/sales-users` | List all sales agents |
| POST | `/admin/sales-users` | Create a sales agent |
| POST | `/admin/sales-users/:id/password` | Reset agent's password |
| GET | `/admin/activity` | Activity timeline |
| GET | `/admin/quotas` | List quotas for a date |
| POST | `/admin/quotas` | Create/update quota |
| GET | `/admin/claim-transfer-requests` | List transfer requests |
| POST | `/admin/claim-transfer-requests/:id/resolve` | Approve/reject transfer |
| GET | `/admin/reports/export` | Download CSV performance report |

### Sales Routes (`/api/sales/*`) — requires SALES role
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sales/dashboard` | Personal dashboard (quota, progress, todos, phase counts) |
| GET | `/sales/leaderboard` | Team leaderboard + my stats |
| GET | `/sales/leads` | List own leads (with filters + pagination) |
| POST | `/sales/leads` | Create a lead (auto-claimed) |
| POST | `/sales/leads/upload` | Bulk import (auto-claimed) |
| GET | `/sales/leads/:id` | Get lead details + events |
| PATCH | `/sales/leads/:id/phase` | Change phase (blocked from CLOSED_WON) |
| PATCH | `/sales/leads/:id/appointment` | Set appointment date |
| PATCH | `/sales/leads/:id/follow-up` | Set follow-up date |
| POST | `/sales/leads/:id/claim` | Claim an unclaimed lead |
| POST | `/sales/leads/:id/claim-transfer-requests` | Request transfer of a claimed lead |
| POST | `/sales/leads/:id/notes` | Add a call note |

---

## Frontend Structure

### Providers (wrapping the entire app)

```
<BrowserRouter>
  <AuthProvider>        ← session state, login/logout, user context
    <ThemeProvider>      ← light/dark theme, localStorage persistence
      <App />            ← routing
      <Toaster />        ← toast notifications
    </ThemeProvider>
  </AuthProvider>
</BrowserRouter>
```

### Routing

```
/              → HomeRedirect (→ /admin or /sales based on role)
/login         → LoginPage
/admin/*       → ProtectedRoute(ADMIN) → AdminRoutes → DashboardShell
/sales/*       → ProtectedRoute(SALES) → SalesRoutes → DashboardShell
*              → Redirect to /
```

### Layout: DashboardShell

```
┌──────────────────────────────────────────────┐
│  Sidebar (fixed, collapsible)  │  Topbar     │
│                                 │  (sticky)   │
│  ┌─────────────────────────┐   │             │
│  │  Nav items (role-based) │   │             │
│  └─────────────────────────┘   │             │
│                                 │             │
│  Main Content Area              │             │
│  ┌─────────────────────────┐   │             │
│  │  <Outlet /> (page)      │   │             │
│  └─────────────────────────┘   │             │
│                                 │             │
│  Footer                        │             │
└──────────────────────────────────────────────┘
```

**Sidebar** — responsive (desktop: fixed, mobile: drawer with backdrop)
- Admin: Overview, Leads, Team, Quotas, Reports, Transfers
- Sales: Overview, Pipeline, New Lead

**Topbar** — sticky, contains breadcrumbs, theme switch, user dropdown (change password, logout)

### Admin Pages

| Page | Component | What it shows |
|------|-----------|---------------|
| Overview | `AdminOverview` | KPI cards, pipeline bar chart, activity donut chart, agent workload chart, **sales leaderboard** |
| Leads | `AdminLeads` | Filterable/searchable lead table with phase management |
| Team | `AdminTeam` | Sales agent list, create agents, reset passwords |
| Quotas | `AdminQuotas` | Set daily call/lead targets per agent |
| Reports | `AdminReports` | Date-range CSV export, activity timeline |
| Transfers | `AdminTransfers` | Approve/reject claim transfer requests |
| Settings | `AdminSettings` | Application settings |

### Sales Pages

| Page | Component | What it shows |
|------|-----------|---------------|
| Overview | `SalesOverview` | Personal conversion stats (won/lost/rate/claimed), quota progress rings, radar chart, pipeline donut chart, **team leaderboard** |
| Pipeline | `SalesPipeline` | Kanban/filtered view of own leads |
| New Lead | `SalesNewLead` | Create a new lead form |
| Settings | `SalesSettings` | Personal settings |

---

## Lead Workflow (Server)

All lead mutations go through `apps/server/src/features/leads/leadWorkflowService.ts`:

1. **Create Lead** → `createLead()` — checks for duplicates (phone/license), creates lead + LEAD_CREATED event
2. **Import Leads** → `importLeads()` — parses CSV/Excel, bulk creates with dedup, emits LEAD_IMPORTED event
3. **Claim Lead** → `claimLead()` — atomic updateMany to prevent race conditions, emits LEAD_CLAIMED event
4. **Update Phase** → `updateLeadPhase()` — validates transition, creates PHASE_CHANGED event with `creditedUserId` for CLOSED_WON
5. **Add Call Note** → `addCallNote()` — logs a CALL_NOTE event with the note text
6. **Transfer Request** → `requestClaimTransfer()` → `resolveClaimTransfer()` — two-step approval workflow

Every mutation is wrapped in a Prisma transaction and emits an `ActivityEvent` for the audit trail.

---

## Conversion Rate & Leaderboard

**How conversion credit works:**
- When an admin closes a lead as `CLOSED_WON`, they must select a `creditedUserId` — the agent who gets credit
- This is stored on the `ActivityEvent` record (`creditedUserId` field)
- This allows accurate attribution even when an admin reassigns credit to a different agent

**Leaderboard metrics:**
| Metric | Source | Description |
|--------|--------|-------------|
| Conversions | `ActivityEvent` where `type=PHASE_CHANGED, toPhase=CLOSED_WON, creditedUserId=X` | How many deals this agent closed |
| Losses | `ActivityEvent` where `type=PHASE_CHANGED, toPhase=CLOSED_LOST, creditedUserId=X` | How many deals lost |
| Conversion Rate | `won / (won + lost) × 100` | Effectiveness percentage |
| Call Notes | `ActivityEvent` where `type=CALL_NOTE, actorId=X` | Activity volume |
| Claimed Leads | `Lead.claimedById = X` | Pipeline ownership |

**Sales leaderboard** is available on both admin and sales dashboards. Sales agents see their own row highlighted.

---

## Theme System

- `ThemeProvider` manages light/dark theme
- Persisted in `localStorage` under `etcrm-theme`
- Applies `dark`/`light` class + `data-theme` attribute on `<html>`
- `ThemeSwitch` component in the topbar toggles between modes

---

## Project Setup

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL database

### Environment Variables

**Server (`apps/server/.env`):**
```
DATABASE_URL=postgresql://...
SHADOW_DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=your-secret
BETTER_AUTH_URL=http://localhost:4000
```

**Client (`apps/client/.env`):**
```
VITE_API_URL=http://localhost:4000/api
VITE_AUTH_URL=http://localhost:4000
```

### Running the app
```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Seed initial data (admin user, sample leads)
pnpm seed

# Start both client and server in development
pnpm dev
```

The client runs at `http://localhost:5173` and the server at `http://localhost:4000`.

### Demo Credentials
After seeding, you can log in with:
- **Admin:** `admin@etcrm.local` / `password123`
- **Sales:** `sales@etcrm.local` / `password123`

---

## File Structure Reference

### Server (`apps/server/src/`)
```
├── app.ts                      ← Express app setup (CORS, Helmet, routes)
├── server.ts                   ← Entry point (starts listening)
├── auth/auth.ts                ← Better Auth configuration
├── config/db.ts                ← Prisma client instance
├── config/env.ts               ← Environment variable loading
├── middleware/
│   ├── auth.ts                 ← requireAuth + requireRole middleware
│   ├── errorHandler.ts         ← Global error handler
│   └── upload.ts               ← Multer file upload config
├── routes/
│   ├── adminRoutes.ts          ← Admin API routes
│   └── salesRoutes.ts          ← Sales API routes
├── controllers/
│   ├── adminController.ts      ← Admin request handlers
│   └── salesController.ts      ← Sales request handlers
├── features/
│   ├── admin/
│   │   ├── adminQueries.ts     ← Admin read queries (summary, leaderboard, reports)
│   │   └── adminCommands.ts    ← Admin write operations (create user, quota)
│   ├── sales/
│   │   ├── salesQueries.ts     ← Sales read queries (dashboard, leaderboard)
│   │   └── salesCommands.ts    ← Sales write operations (claim, note, phase)
│   └── leads/
│       ├── leadWorkflowService.ts ← Lead mutation orchestrator
│       ├── leadService.ts      ← Shared lead utilities
│       └── leadImportService.ts ← CSV/Excel import logic
└── utils/
    ├── dates.ts                ← Business date helpers
    └── format.ts               ← Formatting utilities
```

### Client (`apps/client/src/`)
```
├── main.tsx                    ← React root (providers + router)
├── App.tsx                     ← Route definitions
├── globals.css                 ← Tailwind + theme CSS
├── types.ts                    ← All TypeScript interfaces
├── api/client.ts               ← Axios instance (base URL, credentials)
├── providers/
│   ├── auth-provider.tsx       ← AuthContext + session management
│   └── theme-provider.tsx      ← ThemeContext + dark/light toggle
├── hooks/
│   ├── use-auth.ts             ← AuthContext consumer
│   └── use-toast.ts            ← Toast notification store
├── routes/
│   ├── protected-route.tsx     ← Auth guard wrapper
│   ├── admin-routes.tsx        ← Admin page routes
│   └── sales-routes.tsx        ← Sales page routes
├── features/
│   ├── auth/pages/login-page.tsx
│   ├── admin/
│   │   ├── api.ts              ← Admin API functions
│   │   ├── pages/              ← Admin page components
│   │   └── hooks/              ← Admin data-fetching hooks
│   └── sales/
│       ├── api.ts              ← Sales API functions
│       ├── pages/              ← Sales page components
│       └── hooks/              ← Sales data-fetching hooks
├── components/
│   ├── layout/
│   │   ├── dashboard-shell.tsx ← Main layout (sidebar + topbar + content)
│   │   ├── sidebar.tsx         ← Navigation sidebar
│   │   ├── sidebar-item.tsx    ← Individual nav link
│   │   ├── topbar.tsx          ← Header bar
│   │   └── breadcrumbs.tsx     ← Route breadcrumbs
│   ├── ui/                     ← Reusable UI components
│   │   ├── card.tsx            ← Card container
│   │   ├── kpi-card.tsx        ← KPI metric card
│   │   ├── leaderboard-table.tsx ← Team rankings table
│   │   ├── loading-skeleton.tsx ← Loading placeholder
│   │   ├── circular-progress.tsx ← Progress ring chart
│   │   ├── toast.tsx           ← Toast notification display
│   │   └── ...
│   ├── charts/                 ← Chart components (Recharts wrappers)
│   │   ├── bar-chart.tsx
│   │   ├── donut-chart.tsx
│   │   └── radar-chart.tsx
│   └── forms/
│       ├── form-field.tsx      ← Labeled form field wrapper
│       └── lead-form.tsx       ← Lead creation/edit form
└── lib/
    ├── auth-client.ts          ← Better Auth client instance
    └── utils/                  ← Formatting, validation schemas
```
