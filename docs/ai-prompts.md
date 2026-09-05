# AI prompts

The prompts used during the development of this project, grouped in chronological order by objective.

---

## 1. Initial Architecture & Database Schema Design

### Prompt
> "Design a relational SQLite schema for a Property Rental and Maintenance system adhering to these exact requirements:
> - Users with roles (`property_manager`, `contractor`).
> - Units with rent amount, tenant, grace days, and soft archival.
> - Rent payments with coverage month (`YYYY-MM`).
> - Maintenance requests belonging to exactly one unit with status (`Reported`, `Triaged`, `Scheduled`, `Resolved`) and priorities.
> - Multi-contractor assignment join table.
> - Append-only immutable audit timeline for every request (status changes, assignments, notes).
> - Month-aware alert dismissal table that allows overdue alerts to return in later months."

### What you got
A clean SQL DDL script with table definitions, check constraints, foreign keys, and indexes. It correctly used `GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'` for SQLite month validation and composite primary keys on `maintenance_contractors(request_id, contractor_id)`.

### What you corrected
The initial draft placed a simple `is_dismissed` boolean flag on the `units` table. This would have failed Requirement 10, because once dismissed in August, the unit would remain dismissed in September unless a background cron job manually reset it. We corrected this by creating `rent_alert_dismissals` with a composite unique constraint on `(unit_id, month)`.

---

## 2. Express 5 Routing & Static Fallback Middleware

### Prompt
> "Write an Express application in TypeScript that mounts modular routers for auth, units, maintenance, rent, alerts, and dashboard. Add a 404 handler for API routes and serve compiled static assets from `client/dist` for non-API GET requests."

### What you got
The generated `app.ts` contained:
```typescript
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});
```

### What you corrected (Prompt that produced an error)
When executing `npm test`, the server crashed with:
`TypeError: Missing parameter name at index 6: /api/*; visit https://git.new/pathToRegexpError for info`
Express 5 upgrades `path-to-regexp` to v0.1.x / v8, where unescaped asterisks (`*`) in route strings are no longer permitted unless named (e.g. `{*path}`).
We corrected this by replacing the wildcard route strings with standard middleware checking `req.path.startsWith('/api')`:
```typescript
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} not found.` });
    return;
  }
  next();
});
```

---

## 3. Maintenance Request Lifecycle State Machine

### Prompt
> "Implement `MaintenanceService.updateStatus(requestId, targetStatus, userId, userRole, notes)` with strict state machine validation:
> - Normal flow: Reported -> Triaged -> Scheduled -> Resolved.
> - Scheduled requires at least one assigned contractor or rejects with HTTP 422.
> - Reopening Resolved returns to Triaged (never Reported) or rejects with HTTP 422.
> - Any other transition is rejected with a descriptive message.
> - Automatically emit an append-only audit event into `maintenance_timeline`."

### What you got
A solid validation switch statement checking `currentStatus` against `newStatus`, performing the contractor count check before allowing transition to `Scheduled`, and inserting the timeline record.

### What you corrected
In the initial draft, reopening a request was allowed to move to either `Triaged` or `Reported`. We corrected this to strictly enforce that reopening a `Resolved` ticket can ONLY transition to `Triaged`, rejecting transitions to `Reported` with HTTP 422 as required by Goal 4.

---

## 4. Bulk Rent Reconciliation Engine & CSV Generator

### Prompt
> "Implement `RentService.processBulkRent(month, rows, userId)`:
> - Accepts an array of `{ identifier, amount, notes }`.
> - Matches identifier against unit_number or id.
> - Classifies each row into: `matched`, `underpaid`, `overpaid`, or `unmatched`.
> - Records valid payments into `rent_payments` inside a database transaction.
> - Returns a per-unit report with totals and counts.
> Also write `RentService.generateRentRollCsv(month)` exporting all active units with tenant, monthly rent, amount paid, balance due, and payment status."

### What you got
A clean transactional implementation using `better-sqlite3` transactions, RFC 4180 CSV escaping, and accurate categorization.

### What you corrected
The original draft matched identifiers strictly by numeric `id`. We corrected it to match against `unit_number` case-insensitively first (e.g. "101", "204B", "B1") and fall back to numeric `id`, accommodating real-world bank statement memos.

---

## 5. Automated Integration Test Suite

### Prompt
> "Write integration tests using Node's built-in test runner (`node:test`, `node:assert/strict`) and `supertest` to test all 10 assignment goals end-to-end against the Express API."

### What you got
A 23-test suite covering authentication, RBAC 403 checks, unit archiving, lifecycle state machine moves, multi-contractor assignment, server-side search and pagination, bulk rent categorization, executive dashboard metrics, timeline immutability (405 on PUT/PATCH/DELETE), and overdue alert dismissals.

### What you corrected
In the first test run, tests inside `describe` blocks ran concurrently, causing race conditions where authentication tokens were not yet populated before downstream lifecycle tests ran. We corrected this by authenticating manager and contractor accounts in the `before()` hook and enforcing sequential execution.

---

## 6. Deterministic Synthetic Dataset Generation

### Prompt
> "Write a TypeScript seed script `server/src/db/seed.ts` that populates a realistic, deterministic synthetic dataset into SQLite:
> - Users: 1 Property Manager (`manager@apexpm.com`), 3 Contractors with distinct specialties (Plumbing, Electrical, Carpentry).
> - Units: 6 diverse units with varied rents ($1,250–$2,400), tenant names, differing grace periods (3, 5, 7 days), and 1 soft-archived unit.
> - Rent Payments: Multi-month ledger entries creating matched, underpaid, overpaid, and delinquent scenarios.
> - Maintenance Requests: Tickets spanning all 4 stages (Reported, Triaged, Scheduled, Resolved) with single and multi-contractor assignments.
> - Immutable Timeline: 8 weeks of chronological `status_change` and `note` events distributed across 7-day rolling buckets to validate the executive resolution chart."

### What you got
A comprehensive seeding script using `better-sqlite3` prepared statements that cleanly clears and re-populates all tables.

### What you corrected
The initial draft hardcoded static calendar dates (e.g. `'2023-10-15'`) for the 8-week timeline events. When the executive dashboard queried `datetime('now', '-7 days')`, those hardcoded dates fell outside the rolling 8-week window, rendering empty bars on the chart. We corrected this to compute dynamic relative dates:
```typescript
const now = new Date();
const daysAgo = (weeksAgo: number) => new Date(now.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000).toISOString();
```
This guarantees that regardless of when a reviewer boots the application, the rolling 8-week trend chart always displays rich, populated historical activity.
