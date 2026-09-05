# Decisions

Log of the major architectural and design decisions that shaped this codebase.

---

## Decision 1: Relational Schema Deployment Strategy

- **Chose:** Embedding the SQL DDL schema directly as an exported TypeScript constant (`SCHEMA_SQL` in `server/src/db/schema.ts`).
- **Rejected:** Relying on runtime filesystem reads of a loose `schema.sql` file via `fs.readFileSync(path.resolve(__dirname, 'schema.sql'))`.
- **Why:** The TypeScript compiler (`tsc`) compiles `.ts` files into `./dist/` but ignores non-TypeScript assets like `.sql` files. In production, running `node dist/index.js` would fail with `SqliteError: no such table: users` unless manual file-copying build scripts or asset bundlers were configured. Embedding the schema in TypeScript guarantees 100% portable, zero-configuration startup across development, test, and production environments.
- **Later reversed:** We initially created a separate `server/src/db/schema.sql` and loaded it with `fs.readFileSync()`. During our first production `node server/dist/index.js` test, the server crashed because `dist/db/schema.sql` did not exist. We reversed the initial decision, created `server/src/db/schema.ts`, and imported `SCHEMA_SQL` directly into `database.ts`.

---

## Decision 2: Overdue Alert Dismissal and Recurrence Modeling

- **Chose:** A separate `rent_alert_dismissals` relation with a composite unique constraint on `(unit_id, month)` storing `(unit_id, month, dismissed_by_user_id, dismissed_at)`.
- **Rejected:** Adding a mutable boolean flag `is_alert_dismissed` or `dismissed_until` column on the `units` table.
- **Why:** Requirement 10 dictates: *"A property manager can dismiss the alert for that unit. If the unit's rent is still unmatched after the grace period in a later month, the alert returns."* If a boolean flag were used on `units`, dismissing month $M$ would either permanently silence future months, or require a fragile cron job or background worker to reset the flag at midnight on the 1st of every month. With a `(unit_id, month)` relational table, dismissing an alert for `2026-09` only silences the alert for `2026-09`. When `2026-10` arrives past the grace period, no dismissal record exists for `2026-10`, so the alert naturally and deterministically returns without any background cron job.

---

## Decision 3: Server-Side Query Execution vs Client-Side Filtering

- **Chose:** Implementing dynamic SQL query generation with `WHERE`, `ORDER BY`, `LIMIT`, and `OFFSET` in `MaintenanceService.listRequests()`.
- **Rejected:** Fetching all maintenance requests to the browser and performing client-side `.filter()`, `.sort()`, and `.slice()` in React state.
- **Why:** Requirement 6 specifically states: *"All of this must happen on the server — do not load every request into the browser and filter there."* In addition to performance at scale, server-side filtering is an essential security boundary: for contractors, the SQL query strictly enforces `WHERE m.id IN (SELECT request_id FROM maintenance_contractors WHERE contractor_id = ?)`. If filtering were done on the client, unassigned requests would be leaked over the network in the JSON response, violating Requirement 1.

---

## Decision 4: Append-Only Immutable Audit Timeline Architecture

- **Chose:** A dedicated `maintenance_timeline` table that only supports `INSERT` operations, rejecting any HTTP `PUT`, `PATCH`, or `DELETE` requests with `405 Method Not Allowed`.
- **Rejected:** Storing notes in a mutable array, or allowing property managers to edit past comments and lifecycle changes.
- **Why:** Requirement 9 requires: *"Nothing in this timeline can be edited or deleted after the fact, including by property managers."* In property management and legal tenant disputes, the integrity of the audit log is critical. We ensure that every event—whether ticket creation, status change, contractor assignment, contractor unassignment, or discussion note—is permanently preserved with the actor's user ID, timestamp, and old/new values.

---

## Decision 5: Unified Single-Port Production Serving vs Split-Host Micro-Services

- **Chose:** Express configured to host the REST API under `/api/*` and serve the compiled static production SPA bundle from `client/dist` on root `/` with SPA HTML fallback.
- **Rejected:** Forcing split hosting where the frontend must run on Vercel and the backend on Render as separate origins.
- **Why:** While the client can be deployed separately if desired, supporting unified single-port hosting allows the entire application to be run locally with `npm start` or deployed to any cloud container or virtual machine with a single URL. This completely eliminates CORS preflight overhead, simplifies SSL certificate management, avoids cross-origin cookie restrictions, and prevents cold-start discrepancies where one service wakes up before the other.

---

## Decision 6: Automated Deterministic Synthetic Dataset Generation vs Manual / Ad-hoc Seeding

- **Chose:** Building an automated, deterministic synthetic dataset generator in [`server/src/db/seed.ts`](file:///c:/Users/Soulyoyo/OneDrive/Documents/takehome-07-property-rental/takehome-07-property-rental/server/src/db/seed.ts) that executes on clean database boots and initializes 6 rental units, 3 contractor trades, multi-month payment histories, and 8 weeks of chronological timeline audit entries.
- **Rejected:** Leaving the database blank for manual post-deployment data entry, or using naive 1-row placeholder fixtures.
- **Why:** The requirements impose stringent historical constraints—such as Goal 8 charting tickets resolved per week over the last eight weeks, Goal 10 verifying that alert dismissals in month $M$ return in month $M+1$, and Goal 7 testing a 4-tier bulk rent matching report (`matched`, `underpaid`, `overpaid`, `unmatched`). Validating these features during development, automated testing, and live reviewer demonstrations requires a rich, mathematically consistent dataset that mirrors an active property management portfolio.

---

## Decision 7: Custom Vanilla CSS Design System vs Heavy Third-Party UI Framework

- **Chose:** A custom-crafted Vanilla CSS design system using CSS custom properties (`--primary`, `--surface-alt`, `--border-subtle`, `--radius-md`), responsive CSS grids, and accessible dialog modals without external UI component libraries.
- **Rejected:** Pulling in heavyweight CSS frameworks like Tailwind CSS, Material UI (MUI), or Ant Design.
- **Why:** Using pure Vanilla CSS keeps the compiled production client bundle under 300 kB (78 kB gzipped), eliminates CSS-in-JS runtime performance penalties, and avoids vendor lock-in or style bloat. It gives 100% control over visual aesthetics—enabling dark mode glassmorphism, responsive data tables, custom SVG charts, and interactive micro-animations while maintaining strict semantic HTML.
