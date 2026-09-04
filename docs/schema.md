# Schema

## Table by Table: Columns, Types, and Primary Keys

### 1. `users`
Represents application accounts (Property Managers and Maintenance Contractors).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique user identifier |
| `email` | `TEXT` | `NOT NULL UNIQUE COLLATE NOCASE` | Normalized email address |
| `password_hash` | `TEXT` | `NOT NULL` | Salted bcrypt password hash |
| `name` | `TEXT` | `NOT NULL` | Full name of manager or contractor |
| `role` | `TEXT` | `NOT NULL CHECK (role IN ('property_manager', 'contractor'))` | Role-based authorization type |
| `specialty` | `TEXT` | `NULL` | Contractor trade specialty (e.g. Plumbing, Electrical, HVAC) |
| `created_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Account registration timestamp |

---

### 2. `units`
Represents individual rental apartments, lofts, and suites.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique unit identifier |
| `unit_number` | `TEXT` | `NOT NULL UNIQUE COLLATE NOCASE` | Unique unit designation (e.g. "101", "204B") |
| `address` | `TEXT` | `NOT NULL` | Physical building address |
| `monthly_rent` | `REAL` | `NOT NULL CHECK (monthly_rent >= 0)` | Expected monthly rent amount in dollars |
| `tenant_name` | `TEXT` | `NOT NULL` | Name of current primary leaseholder |
| `tenant_email` | `TEXT` | `NULL` | Tenant contact email |
| `tenant_phone` | `TEXT` | `NULL` | Tenant telephone number |
| `grace_days` | `INTEGER` | `NOT NULL DEFAULT 5 CHECK (grace_days >= 0)` | Number of grace period days after the 1st |
| `is_archived` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1))` | Soft archival flag (1 = hidden from default view) |
| `created_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Creation timestamp |
| `updated_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Last modification timestamp |

---

### 3. `rent_payments`
Individual rent payments recorded against a specific unit and month.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Payment record identifier |
| `unit_id` | `INTEGER` | `NOT NULL REFERENCES units(id) ON DELETE RESTRICT` | Unit being paid for |
| `amount` | `REAL` | `NOT NULL CHECK (amount > 0)` | Payment received in dollars |
| `month` | `TEXT` | `NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')` | Coverage month format (`YYYY-MM`) |
| `paid_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Date and time payment was received |
| `payment_method`| `TEXT` | `NOT NULL DEFAULT 'Bank Transfer'` | Method (ACH, Check, Wire, etc.) |
| `recorded_by_user_id` | `INTEGER` | `NOT NULL REFERENCES users(id)` | Manager who entered the record |
| `notes` | `TEXT` | `NULL` | Check numbers or reconciliation notes |
| `created_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Insertion timestamp |

---

### 4. `maintenance_requests`
Work orders and repair requests belonging to units.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Maintenance request identifier |
| `unit_id` | `INTEGER` | `NOT NULL REFERENCES units(id) ON DELETE RESTRICT` | Associated rental unit |
| `title` | `TEXT` | `NOT NULL` | Short summary of issue |
| `description` | `TEXT` | `NOT NULL` | Full issue description and symptoms |
| `priority` | `TEXT` | `NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent'))` | Severity rating |
| `status` | `TEXT` | `NOT NULL CHECK (status IN ('Reported', 'Triaged', 'Scheduled', 'Resolved'))` | Current lifecycle state |
| `created_by_user_id` | `INTEGER` | `NOT NULL REFERENCES users(id)` | User who reported the problem |
| `created_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Report timestamp |
| `updated_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Last status/details modification |

---

### 5. `maintenance_contractors`
Join table establishing many-to-many relationships between maintenance requests and assigned contractors.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `request_id` | `INTEGER` | `NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE` | Associated request |
| `contractor_id` | `INTEGER` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Assigned contractor user |
| `assigned_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Timestamp of assignment |
| `assigned_by_user_id` | `INTEGER` | `NOT NULL REFERENCES users(id)` | Manager who assigned the contractor |
| **PRIMARY KEY** | `(request_id, contractor_id)` | Composite primary key | Enforces no duplicate assignments |

---

### 6. `maintenance_timeline`
Strictly append-only audit trail logging every lifecycle event, assignment, and note.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Immutable event log identifier |
| `request_id` | `INTEGER` | `NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE` | Associated request |
| `event_type` | `TEXT` | `NOT NULL CHECK (event_type IN ('created', 'status_change', 'assignment', 'unassignment', 'note', 'details_updated'))` | Type of event |
| `old_value` | `TEXT` | `NULL` | Prior status value or unassigned contractor name |
| `new_value` | `TEXT` | `NULL` | New status value or assigned contractor name |
| `user_id` | `INTEGER` | `NOT NULL REFERENCES users(id)` | Author of the action |
| `notes` | `TEXT` | `NULL` | Explanatory note or contractor work log |
| `created_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Timestamp of event occurrence |

---

### 7. `rent_alert_dismissals`
Tracks monthly overdue alert dismissals performed by property managers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Dismissal record identifier |
| `unit_id` | `INTEGER` | `NOT NULL REFERENCES units(id) ON DELETE CASCADE` | Unit whose alert was dismissed |
| `month` | `TEXT` | `NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')` | Specific month of dismissal (`YYYY-MM`) |
| `dismissed_by_user_id` | `INTEGER` | `NOT NULL REFERENCES users(id)` | Property Manager who dismissed alert |
| `dismissed_at` | `TEXT` | `NOT NULL DEFAULT (datetime('now'))` | Dismissal timestamp |
| **UNIQUE** | `(unit_id, month)` | Composite unique constraint | One dismissal record per unit per month |

---

## One-to-Many vs Many-to-Many Relationships

### One-to-Many:
1. **`units` -> `rent_payments` (1:N)**: A unit accumulates multiple rent payments across different months or split installments.
2. **`units` -> `maintenance_requests` (1:N)**: A unit has many historical and active maintenance tickets over its lifetime. Every maintenance request belongs to exactly one unit.
3. **`maintenance_requests` -> `maintenance_timeline` (1:N)**: A single maintenance ticket has an expanding series of chronological audit events.
4. **`users` -> `maintenance_requests` (1:N)**: A user can create many maintenance tickets.
5. **`units` -> `rent_alert_dismissals` (1:N)**: A unit can have distinct dismissals across different months.

### Many-to-Many:
1. **`maintenance_requests` <-> `users` (via `maintenance_contractors`) (M:N)**:
   - A single maintenance request can have multiple contractors assigned simultaneously (e.g. Request #4 in seed data has both a Plumber and a Carpenter assigned for water damage and floor replacement).
   - A single contractor can be concurrently assigned to any number of maintenance tickets across any number of units.
   - Modeled using `maintenance_contractors` with composite primary key `(request_id, contractor_id)`.

---

## Database vs Application Constraints

### Enforced by Database:
- **Foreign Key Referencing**: Cascades or restricts on deletion (`ON DELETE RESTRICT` on units prevents deleting properties with active financial or repair records).
- **Check Constraints**:
  - Valid user roles: `role IN ('property_manager', 'contractor')`
  - Valid request statuses: `status IN ('Reported', 'Triaged', 'Scheduled', 'Resolved')`
  - Valid priorities: `priority IN ('low', 'medium', 'high', 'urgent')`
  - Valid timeline event types: `event_type IN ('created', 'status_change', 'assignment', 'unassignment', 'note', 'details_updated')`
  - Non-negative financial amounts: `monthly_rent >= 0`, `amount > 0`
  - Date string format: `month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'`
- **Uniqueness**: Unique unit numbers, unique emails, and unique `(unit_id, month)` in `rent_alert_dismissals`.

### Enforced by Application Code:
- **State Machine Transition Rules**:
  - Preventing transition to `Scheduled` unless `maintenance_contractors` count > 0.
  - Ensuring reopening from `Resolved` transitions specifically to `Triaged` rather than `Reported`.
  - Disallowing illegal jumps (e.g., `Reported` -> `Scheduled` or `Reported` -> `Resolved`).
- **Authorization & Scoping (RBAC)**:
  - Contractor read filtering (`WHERE id IN (SELECT request_id FROM maintenance_contractors WHERE contractor_id = ?)`).
  - Preventing contractors from querying unit lists or financial tables.
- **Grace Period Calendar Calculation**:
  - Dynamically evaluating whether current day of the month > `unit.grace_days` against current timestamp.
- **Bulk Reconciliation Classification**:
  - Matching string identifiers, evaluating `matched`, `underpaid`, `overpaid`, and `unmatched` tolerances.

### Why draw the line here?
Database constraints provide a rock-solid safety net that guarantees data corruption is structurally impossible, regardless of which client or script connects. However, complex multi-entity business rules (e.g., "cannot move to scheduled unless at least one contractor is joined", or "role-based record visibility") require joining multiple tables and evaluating contextual session state (who is making the request, what role they have, what the current date is). Encoding these as SQL triggers creates hidden side-effects, fragile debugging, and rigid migration paths. Keeping business workflow rules in TypeScript services and structural integrity in SQL schemas strikes the optimal balance of safety, clarity, and maintainability.

---

## What did you deliberately denormalise?

1. **Unit Details Snapshots in Timeline Events**:
   - The `maintenance_timeline` stores `old_value` and `new_value` as textual snapshots (e.g. `'Triaged'`, `'Dave Miller'`) rather than just foreign keys.
   - *Why*: An audit trail must show what happened *at the time of the event*. If a contractor later changes their name or a user account is modified, the audit log should preserve historical fidelity without rewriting past logs.
2. **Current Request Status on `maintenance_requests`**:
   - Rather than calculating the request status on-the-fly by querying `SELECT new_value FROM maintenance_timeline WHERE event_type = 'status_change' ORDER BY created_at DESC LIMIT 1`, we store `status` directly on `maintenance_requests`.
   - *Why*: Allows direct B-tree indexing on `maintenance_requests(status)` for instantaneous server-side filtering, sorting, and pagination across tens of thousands of rows.

---

## What would break first if this had 100x the data?

At 100x scale (e.g., 5,000 units, 50,000 maintenance requests, and 500,000 rent payment records):

1. **Dashboard 8-Week Timeline Aggregation**:
   - *Bottleneck*: The dashboard currently runs count queries scanning `maintenance_timeline` with date range filters across 8 weekly intervals.
   - *Fix*: Create a dedicated `weekly_maintenance_stats` rollup table updated asynchronously or via a lightweight hourly scheduled background job, or index `maintenance_timeline(event_type, new_value, created_at)`.

2. **Unpaginated Rent Roll Fetching**:
   - *Bottleneck*: `RentService.getRentRoll()` pulls all active units and performs an in-memory aggregation with payments for the selected month. At 5,000 units, generating the table in a single JSON payload would cause high memory pressure and slow network response.
   - *Fix*: Implement cursor-based or offset pagination on the rent roll view (`LIMIT 50 OFFSET ?`), and stream the CSV export using a Node.js `Transform` stream directly to the HTTP response socket rather than assembling the entire string in memory.

3. **Single File SQLite Lock Contention in High-Concurrency Multi-Tenant Writes**:
   - *Bottleneck*: While SQLite in WAL mode allows concurrent readers alongside a single writer, hundreds of concurrent contractors and managers submitting updates simultaneously would experience `SQLITE_BUSY` lock wait timeouts.
   - *Fix*: Migrate from single-file SQLite to a horizontally pooled PostgreSQL or Supabase cluster with connection pooling (e.g., PgBouncer), which our clean TypeScript architecture supports by updating the database adapter layer.
