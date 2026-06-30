# Client Cleanup Conventions

This document defines the frontend cleanup direction for ETCRM. The goal is to keep route pages small, move workflow logic into feature hooks, centralize backend calls behind feature API modules, and share CRM-specific components without creating a generic dumping ground.

## Current Problem

`client/src/pages/admin/AdminDashboard.jsx` and `client/src/pages/sales/SalesDashboard.jsx` currently act as route pages, data loaders, form managers, API callers, table renderers, and workflow controllers at the same time.

That works for a small app, but it creates maintainability risk:

- Large files are harder to safely change.
- High-churn files are more likely to gain regressions over time.
- Admin and sales workflows duplicate lead upload, lead creation, notices, and lead display patterns.
- Raw Axios route strings are spread across page components.

## Target Structure

```text
client/src/
  app/
    App.jsx
    routes/
      ProtectedRoute.jsx

  layouts/
    AppLayout.jsx

  pages/
    admin/AdminDashboard.jsx
    sales/SalesDashboard.jsx
    auth/LoginPage.jsx

  features/
    admin/
      components/
        AdminStats.jsx
        QuotaManagement.jsx
        CreateSalesUserForm.jsx
        ReportingPanel.jsx
        RecentActivity.jsx
        AdminLeadsTable.jsx
        AdminLeadFilters.jsx
      hooks/
        useAdminDashboard.js
      api/
        adminApi.js

    sales/
      components/
        SalesStats.jsx
        QuotaProgress.jsx
        PipelineMix.jsx
        TodoLeadList.jsx
        LeadDetailPanel.jsx
        CallHistory.jsx
        AppointmentEditor.jsx
        PhaseEditor.jsx
      hooks/
        useSalesDashboard.js
      api/
        salesApi.js

    leads/
      components/
        LeadForm.jsx
        LeadUpload.jsx
        LeadFieldsGrid.jsx
      hooks/
        useLeadUpload.js
      utils/
        leadPayload.js

    auth/
      components/
        LoginForm.jsx
      hooks/
        useLogin.js
      api/
        authApi.js

  components/
    ui/
      Badge.jsx
      StatCard.jsx
      Notice.jsx
      Button.jsx
      Field.jsx

  api/
    client.js

  utils/
    format.js
    AuthContext.jsx
```

## Folder Rules

### `pages/`

Route-level shells only.

Pages should compose feature components and call one main page hook. They should not contain long API workflows, large forms, large tables, or business-specific helper logic.

Good shape:

```jsx
export function AdminDashboard() {
  const admin = useAdminDashboard();

  return (
    <AppLayout title="Admin Dashboard" subtitle="Manage leads, quotas, and performance exports.">
      <AdminStats summary={admin.summary} />
      <Notice message={admin.notice} />
      <LeadUpload onUpload={admin.uploadLeads} />
      <QuotaManagement {...admin.quotaProps} />
      <CreateSalesUserForm {...admin.salesUserProps} />
      <LeadForm mode="admin" {...admin.leadFormProps} />
      <RecentActivity activities={admin.activities} onRefresh={admin.loadData} />
      <AdminLeadsTable {...admin.leadsTableProps} />
    </AppLayout>
  );
}
```

### `features/admin/`

Admin-only workflows and components.

Examples:

- Sales user management
- Admin quota management
- Admin activity feed
- Admin lead assignment table
- Admin reporting/export panel

### `features/sales/`

Sales-only workflows and components.

Examples:

- Sales quota progress
- Lead to-do list
- Active lead detail panel
- Phase editor
- Appointment editor
- Call history

### `features/leads/`

Shared CRM lead workflows used by both admin and sales.

Examples:

- Lead creation form
- CSV/Excel lead upload
- Lead extra fields display
- Lead payload normalization

Do not put admin-only or sales-only behavior here. Shared lead components should accept props that let each feature control the role-specific behavior.

### `components/ui/`

Generic visual components only. These should not know about admin, sales, leads, quotas, auth, or backend routes.

Good examples:

- `Badge`
- `StatCard`
- `Notice`
- `Button`
- `Field`

Avoid putting domain workflows in `components/ui`.

## Hook Rules

Start with one main hook per route workflow:

```text
useAdminDashboard()
useSalesDashboard()
useLogin()
```

These hooks are page controllers. They own state, loading, notice/error messages, and workflow actions for the page.

If a hook becomes too large, split it by workflow:

```text
useAdminLeads()
useAdminQuotas()
useAdminUsers()
useAdminActivity()
useSalesLeadDetail()
useLeadUpload()
```

Do not split hooks just to create more files. Split when a hook has a clear responsibility boundary or becomes hard to scan.

## API Rules

Keep `client/src/api/client.js` as Axios setup only.

It should own:

- `baseURL`
- request interceptors
- response interceptors, if added later
- shared Axios config

Feature API files should own endpoint paths:

```text
features/admin/api/adminApi.js
features/sales/api/salesApi.js
features/auth/api/authApi.js
```

Example:

```js
import { api } from "../../../api/client";

export const adminApi = {
  getSummary: () => api.get("/admin/summary").then((res) => res.data),
  getSalesUsers: () => api.get("/admin/sales-users").then((res) => res.data.users),
  getLeads: (params) => api.get("/admin/leads", { params }).then((res) => res.data.leads),
  createLead: (payload) => api.post("/admin/leads", payload).then((res) => res.data),
  assignLead: (leadId, salesUserId) =>
    api.patch(`/admin/leads/${leadId}/assign`, { salesUserId }).then((res) => res.data)
};
```

Hooks should call feature API functions, not raw Axios endpoints.

Good:

```js
const leads = await adminApi.getLeads(filters);
```

Avoid:

```js
const { data } = await api.get("/admin/leads", { params: filters });
```

## Auth And Axios Convention

The shared Axios client automatically attaches the JWT from `localStorage`:

```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("etcrm_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

This means every request made through `api` can reach protected backend routes such as:

```text
/api/admin/*
/api/sales/*
/api/auth/me
/api/auth/password
```

Only use the shared `api` instance for backend calls. Do not create separate Axios instances in feature files unless there is a clear reason.

## Naming Rules

- Components use PascalCase: `AdminStats.jsx`, `LeadUpload.jsx`.
- Hooks start with `use`: `useAdminDashboard.js`.
- API modules end with `Api`: `adminApi.js`.
- Utility modules use descriptive nouns or verbs: `leadPayload.js`, `format.js`.
- Route pages keep the `Page` or route name convention already present: `LoginPage.jsx`, `AdminDashboard.jsx`, `SalesDashboard.jsx`.

## Cleanup Order

### Phase 1: Admin Dashboard

Split `AdminDashboard.jsx` first because it has the worst health score.

Extract in this order:

1. `AdminStats`
2. `LeadUpload`
3. `ReportingPanel`
4. `QuotaManagement`
5. `CreateSalesUserForm`
6. `LeadForm`
7. `RecentActivity`
8. `AdminLeadFilters`
9. `AdminLeadsTable`
10. `useAdminDashboard`
11. `adminApi`

Keep behavior unchanged during this phase.

### Phase 2: Sales Dashboard

Split `SalesDashboard.jsx` after admin cleanup establishes the pattern.

Extract in this order:

1. `SalesStats`
2. `QuotaProgress`
3. `PipelineMix`
4. `LeadUpload`
5. `LeadForm`
6. `TodoLeadList`
7. `LeadDetailPanel`
8. `PhaseEditor`
9. `AppointmentEditor`
10. `CallHistory`
11. `useSalesDashboard`
12. `salesApi`

Reuse shared lead components created in Phase 1 where possible.

### Phase 3: Auth Page

Split `LoginPage.jsx` only after dashboard cleanup.

Extract:

1. `LoginForm`
2. `useLogin`
3. `authApi`

`AuthContext` can stay in `utils/AuthContext.jsx` for now. Move it later only if the app grows a broader `auth` feature boundary.

## Review Checklist

Before considering a frontend cleanup complete:

- Route pages are mostly composition.
- Feature API modules contain endpoint paths.
- Hooks own async workflows and page state.
- Shared lead components are not tied to admin or sales unless explicitly passed by props.
- Generic UI components have no backend/API knowledge.
- No behavior changed unless intentionally requested.
- Existing run/build commands still pass.

