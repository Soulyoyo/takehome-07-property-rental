-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('property_manager', 'contractor')),
    specialty TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Units table
CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
    address TEXT NOT NULL,
    monthly_rent REAL NOT NULL CHECK (monthly_rent >= 0),
    tenant_name TEXT NOT NULL,
    tenant_email TEXT,
    tenant_phone TEXT,
    grace_days INTEGER NOT NULL DEFAULT 5 CHECK (grace_days >= 0),
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_units_is_archived ON units(is_archived);
CREATE INDEX IF NOT EXISTS idx_units_unit_number ON units(unit_number);

-- Rent payments table
CREATE TABLE IF NOT EXISTS rent_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    amount REAL NOT NULL CHECK (amount > 0),
    month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
    recorded_by_user_id INTEGER NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rent_payments_unit_month ON rent_payments(unit_id, month);
CREATE INDEX IF NOT EXISTS idx_rent_payments_month ON rent_payments(month);

-- Maintenance requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL CHECK (status IN ('Reported', 'Triaged', 'Scheduled', 'Resolved')),
    created_by_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_unit ON maintenance_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_priority ON maintenance_requests(priority);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_created ON maintenance_requests(created_at);

-- Multi-contractor assignment join table
CREATE TABLE IF NOT EXISTS maintenance_contractors (
    request_id INTEGER NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    contractor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    assigned_by_user_id INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY (request_id, contractor_id)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_contractors_contractor ON maintenance_contractors(contractor_id);

-- Append-only immutable maintenance timeline / audit log
CREATE TABLE IF NOT EXISTS maintenance_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_change', 'assignment', 'unassignment', 'note', 'details_updated')),
    old_value TEXT,
    new_value TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_maintenance_timeline_request ON maintenance_timeline(request_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_timeline_created ON maintenance_timeline(created_at);

-- Rent alert dismissals table (per unit, per month)
CREATE TABLE IF NOT EXISTS rent_alert_dismissals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    dismissed_by_user_id INTEGER NOT NULL REFERENCES users(id),
    dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (unit_id, month)
);

CREATE INDEX IF NOT EXISTS idx_rent_alert_dismissals_unit_month ON rent_alert_dismissals(unit_id, month);
