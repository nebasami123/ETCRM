# Server Cleanup Conventions

This document defines the backend cleanup direction for ETCRM. The goal is to keep Express controllers small, keep Prisma as the schema source of truth, separate read and write workflows only where it reduces real controller weight, and avoid creating a large backend folder maze.

## Current Problem

`server/src/controllers/adminController.ts` and `server/src/controllers/salesController.ts` currently act as HTTP handlers, request validators, Prisma query modules, command/workflow services, activity log writers, report builders, and import coordinators at the same time.

That creates maintainability risk:

- Large controllers are hard to scan and easy to regress.
- CRUD workflows are mixed with HTTP response code.
- Business rules such as sales lead claiming, duplicate detection, quota day parsing, and activity logging are spread across handlers.
- Prisma query shapes are repeated directly inside controllers.
- Comments are missing in the few places where domain intent is not obvious.

## Target Structure

```text
server/src/
  app.ts
  server.ts

  config/
    db.ts

  routes/
    adminRoutes.ts
    salesRoutes.ts
    authRoutes.ts

  controllers/
    adminController.ts
    salesController.ts
    authController.ts

  features/
    admin/
      adminQueries.ts
      adminCommands.ts

    sales/
      salesQueries.ts
      salesCommands.ts

    auth/
      authCommands.ts

    leads/
      leadService.ts
      leadImportService.ts

    activity/
      activityLogService.ts

  middleware/
    auth.ts
    errorHandler.ts

  types/
    express.d.ts

  utils/
    dates.ts
```

This is intentionally minimal. Do not create one file per endpoint unless a file becomes hard to scan.

## Folder Rules

### `routes/`

Routes only bind HTTP paths, middleware, upload middleware, and controller functions.

Good:

```ts
adminRoutes.get("/summary", adminSummary);
adminRoutes.post("/leads/upload", upload.single("file"), uploadLeads);
```

Routes should not contain validation, Prisma calls, or business branching.

### `controllers/`

Controllers are HTTP adapters.

They may:

- read `req.params`, `req.query`, `req.body`, `req.file`, and `req.user`
- perform small Zod validation inline or through a local controller-level schema constant
- call one query, command, or service for the main behavior
- translate the result into `res.json`, `res.status`, attachment headers, or `next(error)`

They should not:

- build large Prisma `where` objects
- hash passwords
- create activity logs directly
- parse uploaded files directly
- decide business rules such as whether a sales user can claim a lead
- contain long report-building logic

Do not add a separate `schemas/` folder for now. Prisma owns database schema, and Zod request validation can stay close to the controller or move into the relevant command only when it is reused.

### `features/*Queries.ts`

Query files are read-only. Keep them grouped by feature.

Examples:

- `adminQueries.ts`: admin summary, admin lead list, admin activity list, quota list, report data reads
- `salesQueries.ts`: sales dashboard, sales lead list, sales lead detail

Queries may call Prisma reads such as `findMany`, `findUnique`, `count`, and `groupBy`.

Queries should not:

- create, update, or delete data
- write activity logs
- mutate files
- hash passwords

### `features/*Commands.ts`

Command files own write workflows. Keep them grouped by feature.

Examples:

- `adminCommands.ts`: create sales user, create admin lead, assign lead, upsert quota, upload admin leads
- `salesCommands.ts`: create sales lead, update phase, update appointment, add call note, upload sales leads
- `authCommands.ts`: login, change password

Commands may call Prisma writes such as `create`, `update`, `upsert`, and `createMany`.

Commands should call shared services for cross-cutting behavior such as duplicate detection, lead access, import parsing, and activity logging.

### `features/leads/`

Shared lead workflows go here.

Good examples:

- `leadService.ts`: duplicate detection, lead access rules, shared lead creation helpers
- `leadImportService.ts`: CSV/XLSX parsing, row normalization, import preparation

Do not split lead services into many tiny files until the combined file becomes hard to scan.

### `features/activity/`

Activity logging is shared by admin and sales. Keep it in a small service.

Good:

```ts
await logActivity({ userId, leadId, type, metadata });
```

Controllers should not write activity logs directly after cleanup.

### `utils/`

Utilities are pure, low-level helpers with no Prisma, Express, auth, or filesystem workflow knowledge.

Current good utility:

- `dates.ts`: `startOfDay`, `endOfDay`, `parseDay`

Do not put business workflows in `utils`.

Avoid:

- `utils/leadImport.ts`
- `utils/auth.ts`
- `utils/reports.ts`
- `utils/activity.ts`

Those belong in features or middleware.

## Minimal Command/Query Rules

Use a light command/query split as an organizing convention, not a full CQRS architecture.

- `GET` endpoints should call query functions when the read logic is more than a few lines.
- `POST`, `PATCH`, and `DELETE` endpoints should call command functions when the write workflow is more than a few lines.
- Keep files grouped by CRUD area, not one file per action.
- It is fine for a very small controller action to stay in the controller until it grows.
- Do not introduce DTO classes, repositories, buses, handlers, or CQRS framework patterns.

Good:

```ts
const dashboard = await getSalesDashboard({ userId: req.user.id });
const lead = await updateSalesLeadPhase({ leadId, actor: req.user, input });
```

Avoid:

```ts
const command = new UpdateLeadPhaseCommand(...);
await commandBus.execute(command);
```

## Prisma Rules

Keep Prisma as the database schema source of truth.

Use:

- `server/prisma/schema.prisma` for local SQLite development
- `server/prisma/schema.postgres.prisma` for hosted Postgres deployment, while the project keeps that deployment split
- Prisma Client generated types for enums/models

Do not create TypeScript schema files that duplicate Prisma models.

Keep `server/src/config/db.ts` as Prisma setup only.

Queries and commands may use Prisma directly, but controllers should not once a workflow has been extracted.

Prefer typed Prisma inputs for complex filters:

```ts
const where: Prisma.LeadWhereInput = { ... };
```

Avoid `any`. Use `unknown` at external boundaries, then narrow with Zod or local guards.

## Prisma SQL File Policy

Normal development should use Prisma schema commands, not hand-written SQL files.

The current SQL files are manual bootstrap/migration artifacts:

- `manual-init.sql`: full manual SQLite table initialization, referenced by `PROJECT_STATUS.md`
- `add-realestate-fields.sql`: historical manual `Lead` column additions, currently not referenced
- `add-lead-ownership.sql`: historical manual `createdById` addition, currently not referenced

Keep `manual-init.sql` only if the project still needs a manual emergency/local bootstrap path. Otherwise prefer `prisma db push` or Prisma migrations.

The two `add-*.sql` files are not necessary for normal Prisma usage if `schema.prisma` is current. They can be archived or removed after confirming no deployment process uses them.

Do not add new raw SQL files unless Prisma cannot express the operation or a deployment provider requires manual SQL.

## Error And Validation Rules

Keep Zod validation close to the controller or command that owns the external input.

Commands and queries may throw normal errors for unexpected failures.

For intentional business failures, prefer a tiny HTTP-aware error helper only if repeated status handling becomes noisy:

```ts
throw new HttpError(409, "A lead with this phone or license already exists");
```

Do not scatter `res.status(...).json(...)` inside services, commands, or queries. Only controllers and middleware should know about `res`.

## Comments Rules

Do not comment obvious code.

Add short comments only where domain intent is not self-evident:

- why unassigned `NEW` leads can appear in sales queues
- why moving `NEW` to `CONTACTED` claims a lead
- how duplicate detection chooses phone/license keys
- how uploaded file row numbers map to spreadsheet rows
- how quota/report day boundaries are interpreted

Good:

```ts
// CSV parsers report data rows only, so add 2 to match the spreadsheet row number.
```

Avoid:

```ts
// Create a lead
```

## Naming Rules

- Controllers end in `Controller`: `adminController.ts`
- Routes end in `Routes`: `adminRoutes.ts`
- Grouped query files end in `Queries`: `adminQueries.ts`
- Grouped command files end in `Commands`: `salesCommands.ts`
- Services end in `Service`: `leadService.ts`, `activityLogService.ts`
- Utilities use plain nouns or verbs: `dates.ts`
- Type augmentation stays in `types/`: `express.d.ts`

## Cleanup Order

### Phase 1: Shared Lead And Activity Services

Extract shared behavior first so admin and sales cleanup can reuse it.

1. Move `services/leadImport.ts` to `features/leads/leadImportService.ts`.
2. Create `features/leads/leadService.ts` for duplicate detection and lead access rules.
3. Create `features/activity/activityLogService.ts`.

Keep endpoint behavior unchanged.

### Phase 2: Auth

Auth is small and establishes the pattern without adding many files.

Extract:

1. `features/auth/authCommands.ts`

Keep login and change password in the same command file.

### Phase 3: Sales

Extract grouped sales reads and writes.

1. `features/sales/salesQueries.ts`
2. `features/sales/salesCommands.ts`

Keep `salesController.ts` as the HTTP response layer.

### Phase 4: Admin

Admin is the largest cleanup and should happen after shared services and sales patterns are established.

1. `features/admin/adminQueries.ts`
2. `features/admin/adminCommands.ts`

If report CSV generation remains large after this, extract `features/admin/adminReportService.ts`.

Keep behavior unchanged unless a separate product request asks for behavior changes.

### Phase 5: Polish

After the code has clear homes:

1. Add targeted comments for non-obvious domain rules.
2. Add tests for pure services where possible.
3. Re-run typecheck/build.

## Review Checklist

Before considering backend cleanup complete:

- Controllers are mostly HTTP adapters.
- No separate TS schema layer duplicates Prisma.
- Read-heavy logic is grouped in feature query files.
- Write-heavy logic is grouped in feature command files.
- Shared lead import, duplicate detection, access checks, and activity logging are services.
- `utils/` contains only pure low-level helpers.
- Prisma setup stays in `config/db.ts`.
- Raw SQL files are either documented as manual bootstrap artifacts or removed.
- No behavior changed unless intentionally requested.
- Comments explain domain intent, not obvious code.
- `pnpm build`, `pnpm --dir server typecheck`, and `pnpm --dir client lint` pass.
