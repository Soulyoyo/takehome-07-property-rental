# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/soulyoyo/takehome-07-property-rental
- **Live application:** https://takehome-07-property-rental-j36k.onrender.com

## Notes for the reviewer

- **Quick 1-Click Role Switcher**: When logged into the application, a role-switcher bar is visible in the top navigation allowing you to instantly toggle between **Alex Sterling (Property Manager)**, **Dave Miller (Contractor - Plumbing)**, and **Sarah Chen (Contractor - Electrical)** to immediately test server-enforced RBAC and view restrictions without repeatedly logging out and typing credentials.
- **Unified Single-Port Deployment**: The Express server is architected to serve both the JSON REST API (`/api/*`) and the compiled production React SPA bundle (`client/dist`) from the same process on port 4000. It can be started with `npm run build && npm start`.
- **Free Tier Host Sleep Notice**: If deployed to free-tier container hosting (e.g. Render), instances may spin down when idle. The first incoming request can take 30–50 seconds to boot the container; subsequent requests respond in under 20ms.
- **Visual Walkthrough & Interface Snapshots**: 15 production interface screenshots demonstrating all core workflows are saved in [`docs/screenshots/`](docs/screenshots/) and indexed below:
  1. [`login_window.png`](docs/screenshots/login_window.png) — Authentication modal & 1-click demo role switcher (Goal 1)
  2. [`dashboard.jpg`](docs/screenshots/dashboard.jpg) — Executive dashboard with 4 KPIs, distributions, and 8-week trend chart (Goal 8)
  3. [`dashboard_window.png`](docs/screenshots/dashboard_window.png) — Dashboard real-time counters & interactive SVG resolution curve (Goal 8)
  4. [`rental_units.png`](docs/screenshots/rental_units.png) — Rental units portfolio table with monthly rent, grace periods, and status (Goal 2)
  5. [`rental_unit_window.png`](docs/screenshots/rental_unit_window.png) — Unit inspection modal with tenant contact & unit maintenance history (Goals 2 & 3)
  6. [`rental_unit_window_edit.png`](docs/screenshots/rental_unit_window_edit.png) — Edit unit modal for rent, tenant info, and grace period days (Goal 2)
  7. [`maintenance_desk.jpg`](docs/screenshots/maintenance_desk.jpg) — Central maintenance desk with server-side search, filter, sort, and pagination (Goal 6)
  8. [`maintenance_plumber_scheduled_window.png`](docs/screenshots/maintenance_plumber_scheduled_window.png) — Scheduled state modal with contractor guard & immutable timeline (Goals 4, 5, 9)
  9. [`maintenance_plumber_resolved_window.png`](docs/screenshots/maintenance_plumber_resolved_window.png) — Resolved state modal with state machine reopen returning strictly to Triaged (Goal 4)
  10. [`maintenance_electrician_resolved_window.png`](docs/screenshots/maintenance_electrician_resolved_window.png) — Contractor work order resolution modal with immutable notes (Goals 4 & 9)
  11. [`maintenance_plumber.png`](docs/screenshots/maintenance_plumber.png) — Contractor scoped view for Dave Miller (Plumbing Pros) (Goals 1 & 5)
  12. [`maintenance_electrician.png`](docs/screenshots/maintenance_electrician.png) — Contractor scoped view for Sarah Chen (Sparky Electric) (Goals 1 & 5)
  13. [`rent_ledger.png`](docs/screenshots/rent_ledger.png) — Bulk rent reconciliation with 4-tier match reporting (Goal 7)
  14. [`rent_ledger_current_rent.png`](docs/screenshots/rent_ledger_current_rent.png) — Current rent roll ledger & overdue rent tracking (Goals 7 & 10)
  15. [`rent_ledger_current_rent_.png`](docs/screenshots/rent_ledger_current_rent_.png) — Rent roll data table & RFC 4180 CSV export download (Goal 7)

## Demo credentials

| Role | Email | Password | Description / Scope |
|------|-------|----------|---------------------|
| Property Manager | `manager@apexpm.com` | `manager123` | Full portfolio view, unit CRUD/archival, bulk rent reconciliation, rent roll CSV export, contractor assignments, alert dismissals |
| Contractor (Plumbing) | `dave@plumbingpros.com` | `contractor123` | Contractor scoped to plumbing jobs; restricted from units, rent ledger, and alerts; can update status and add notes to assigned requests |
| Contractor (Electrical) | `sarah@sparkyelec.com` | `contractor123` | Contractor scoped to electrical & HVAC jobs; restricted from units, rent ledger, and alerts; can update status and add notes to assigned requests |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React 18, TypeScript, Vite, Vanilla CSS Design System | Fast SPA rendering, full type safety, and a custom Vanilla CSS design system (Inter typography, responsive tables, glassmorphic cards, custom SVG chart) with zero third-party CSS library bloat. |
| Backend | Node.js, Express 5, TypeScript | Clean layered architecture (`routes/`, `controllers/`, `services/`, `middleware/`, `db/`), robust error handling, and strict domain services for state machine validation. |
| Database | SQLite via `better-sqlite3` | Synchronous, high-performance C-level binding supporting WAL mode, strict foreign key constraints, check constraints, transaction atomicity, and zero-configuration portability. |
| Hosting | Unified Node.js container / Render Web Service | Serves API endpoints and compiled static SPA bundle from a single origin, completely eliminating CORS overhead, cross-origin cookie quirks, and split-host downtime. |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Email & password authentication with bcrypt. Property manager sees full portfolio; contractor is restricted on the server via `requireRole` middleware (403 Forbidden on units, rent, and assigning contractors). |
| 2 | Units | Done | Units created with unit number, address, monthly rent, tenant name, contact info, and grace period days. Soft archival and restoration implemented; archiving hides unit from default view while preserving maintenance tickets and rent ledger history. |
| 3 | Maintenance requests | Done | Belong to exactly one unit; carry description, priority, status, and contractor assignments. Managers and contractors can create requests and edit description/priority. Opening a unit displays its complete maintenance history. |
| 4 | Maintenance request lifecycle with rules | Done | Enforced 4-stage state machine: `Reported` -> `Triaged` -> `Scheduled` -> `Resolved`. Server strictly rejects moving to `Scheduled` without an assigned contractor (HTTP 422). Reopening a `Resolved` request returns it strictly to `Triaged` (never `Reported`). All invalid moves rejected with explanatory messages. |
| 5 | Assignment | Done | Multi-contractor assignment join table (`maintenance_contractors`). Any number of contractors can be assigned to a request. Only property managers can add or remove assignments. Contractor list endpoint is scoped strictly to assigned requests on the SQL query level. |
| 6 | Finding requests | Done | Server-side text search over titles and descriptions; server-side filters for unit, status, priority, and contractor; server-side sorting by created date, priority, or status; server-side pagination with total matches and page counts. Never loaded into memory. |
| 7 | Acting on rent for many units at once | Done | Bulk-recording processes batches of unit identifiers and amounts in one atomic transaction, generating a per-unit report classifying each row as `matched`, `underpaid`, `overpaid`, or `unmatched`. Current rent roll exports as an RFC 4180 CSV attachment with summary totals. |
| 8 | A dashboard | Done | Landing view shows 4 headline numbers (open maintenance requests, units with rent overdue this month, requests resolved this week, total rent collected this month), breakdowns by status and contractor, and an interactive 8-week historical resolution SVG chart. |
| 9 | History you cannot rewrite | Done | Append-only `maintenance_timeline` records ticket creation, every status transition with old/new values and actor, contractor assignments/unassignments, and timestamped discussion notes. Any HTTP `PUT`, `PATCH`, or `DELETE` attempt is rejected with `405 Method Not Allowed`. |
| 10 | Rent alerts | Done | Units whose rent is not fully matched once the grace period passes appear in the alerts area and increment the live navbar badge. Managers can dismiss alerts for month $M$. Stored in `rent_alert_dismissals(unit_id, month)` so that if rent is unpaid in month $M+1$, the alert automatically returns. |

## How much time did you actually spend?

Approximately **14 hours total**, paced over multiple focused sessions:
- Schema, connection pragmas, and rich multi-week seed data: ~1.25 hours
- Server authentication, JWT issuance, and RBAC middleware: ~0.75 hours
- Maintenance request lifecycle state machine & immutable timeline: ~2.0 hours
- Server-side search, filtering, sorting, and pagination engine: ~1.25 hours
- Bulk rent reconciliation, matching classifier, and CSV rent roll exporter: ~1.5 hours
- Grace period overdue alert engine and month-specific recurrence: ~1.25 hours
- Executive dashboard metrics and 8-week trend aggregation: ~1.25 hours
- Automated integration test suite (23 tests across all 10 goals): ~1.5 hours
- React 18 frontend with custom Vanilla CSS design system & SVG chart: ~2.75 hours
- Architectural and technical decision documentation (`docs/*` and `SUBMISSION.md`): ~1.5 hours

## What would you do next, with another 12 hours?

1. **Automated Bank Transfer Webhooks / Plaid Integration**: Connect directly to bank APIs (via Plaid or Stripe Financial Connections) to pull bank deposits automatically into the bulk rent reconciliation screen, eliminating manual CSV paste.
2. **Tenant Portal & Online Maintenance Intake**: Build a tenant login view where residents can view their current rent balance, download digital payment receipts, upload smartphone photos of leaking fixtures, and receive SMS updates as contractors triage and schedule repairs.
3. **Automated Late-Fee Engine with Notice Generation**: Implement configurable late fee policies (e.g. flat $50 or 5% after grace period) that automatically append fee line-items to delinquent accounts and generate downloadable PDF formal late notices.
4. **Preventive Maintenance Schedules**: Introduce recurring work order templates (e.g., HVAC filter changes every 90 days, annual fire extinguisher inspections) that automatically spawn `Reported` maintenance tickets on schedule.

## What are you least happy with in this codebase, and why?

While the SQLite database with WAL mode and transaction wrapping provides exceptional local speed and test portability, **SQLite's single-writer concurrency model is the architectural component I would change first for enterprise production**. In a high-concurrency property management firm where dozens of contractors simultaneously upload site notes while accountants bulk-reconcile thousands of rent checks, SQLite can experience lock wait contention (`SQLITE_BUSY`). 

Although our layered architecture completely decouples the Express services from the raw SQL queries—meaning switching to a connection-pooled PostgreSQL cluster (e.g. via Supabase or AWS Aurora) would only require replacing the database adapter file—I would have preferred to include a dual-driver abstraction out of the box (SQLite for zero-config offline development/testing, and PostgreSQL for distributed production deployments).
