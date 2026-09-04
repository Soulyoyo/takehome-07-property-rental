import { getDb } from '../db/database.js';
import { Unit, MaintenanceRequest, RentPayment } from '../types/index.js';

export interface CreateUnitDTO {
  unit_number: string;
  address: string;
  monthly_rent: number;
  tenant_name: string;
  tenant_email?: string;
  tenant_phone?: string;
  grace_days?: number;
}

export interface UpdateUnitDTO {
  unit_number?: string;
  address?: string;
  monthly_rent?: number;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  grace_days?: number;
}

export class UnitService {
  /**
   * List units. Defaults to active (unarchived) units.
   * Can include archived units via includeArchived = true.
   */
  static listUnits(includeArchived: boolean = false, customDb?: any): Unit[] {
    const db = customDb || getDb();
    const query = includeArchived
      ? `SELECT * FROM units ORDER BY is_archived ASC, unit_number ASC`
      : `SELECT * FROM units WHERE is_archived = 0 ORDER BY unit_number ASC`;

    return db.prepare(query).all() as Unit[];
  }

  /**
   * Get unit by ID with its maintenance requests and rent payment history.
   */
  static getUnitById(id: number, customDb?: any): (Unit & { maintenance_requests: MaintenanceRequest[]; rent_payments: RentPayment[] }) | null {
    const db = customDb || getDb();

    const unit = db.prepare(`SELECT * FROM units WHERE id = ?`).get(id) as Unit | undefined;
    if (!unit) return null;

    // Fetch maintenance requests for this unit
    const requests = db.prepare(`
      SELECT m.*, u.unit_number, u.address as unit_address, u.tenant_name, creator.name as creator_name
      FROM maintenance_requests m
      JOIN units u ON m.unit_id = u.id
      JOIN users creator ON m.created_by_user_id = creator.id
      WHERE m.unit_id = ?
      ORDER BY m.created_at DESC
    `).all(id) as MaintenanceRequest[];

    // Attach assigned contractors to each request
    const contractorStmt = db.prepare(`
      SELECT c.id, c.name, c.email, c.specialty, mc.assigned_at
      FROM maintenance_contractors mc
      JOIN users c ON mc.contractor_id = c.id
      WHERE mc.request_id = ?
      ORDER BY c.name ASC
    `);

    for (const req of requests) {
      req.contractors = contractorStmt.all(req.id) as any[];
    }

    // Fetch rent payments for this unit
    const payments = db.prepare(`
      SELECT p.*, u.name as recorded_by_name
      FROM rent_payments p
      JOIN users u ON p.recorded_by_user_id = u.id
      WHERE p.unit_id = ?
      ORDER BY p.month DESC, p.paid_at DESC
    `).all(id) as RentPayment[];

    return {
      ...unit,
      maintenance_requests: requests,
      rent_payments: payments,
    };
  }

  /**
   * Create a new unit.
   */
  static createUnit(dto: CreateUnitDTO, customDb?: any): Unit {
    const db = customDb || getDb();

    if (!dto.unit_number || !dto.unit_number.trim()) {
      throw { status: 400, message: 'Unit number is required.' };
    }
    if (!dto.address || !dto.address.trim()) {
      throw { status: 400, message: 'Address is required.' };
    }
    if (dto.monthly_rent === undefined || dto.monthly_rent === null || dto.monthly_rent < 0) {
      throw { status: 400, message: 'Monthly rent must be a non-negative number.' };
    }
    if (!dto.tenant_name || !dto.tenant_name.trim()) {
      throw { status: 400, message: 'Current tenant name is required.' };
    }

    // Check for unique unit_number
    const existing = db.prepare(`SELECT id FROM units WHERE unit_number = ? COLLATE NOCASE`).get(dto.unit_number.trim());
    if (existing) {
      throw { status: 409, message: `A unit with number "${dto.unit_number.trim()}" already exists.` };
    }

    const graceDays = dto.grace_days !== undefined && dto.grace_days >= 0 ? dto.grace_days : 5;

    const stmt = db.prepare(`
      INSERT INTO units (unit_number, address, monthly_rent, tenant_name, tenant_email, tenant_phone, grace_days, is_archived)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const result = stmt.run(
      dto.unit_number.trim(),
      dto.address.trim(),
      Number(dto.monthly_rent),
      dto.tenant_name.trim(),
      dto.tenant_email?.trim() || null,
      dto.tenant_phone?.trim() || null,
      graceDays
    );

    return db.prepare(`SELECT * FROM units WHERE id = ?`).get(result.lastInsertRowid) as Unit;
  }

  /**
   * Update an existing unit.
   */
  static updateUnit(id: number, dto: UpdateUnitDTO, customDb?: any): Unit {
    const db = customDb || getDb();

    const existing = db.prepare(`SELECT * FROM units WHERE id = ?`).get(id) as Unit | undefined;
    if (!existing) {
      throw { status: 404, message: 'Unit not found.' };
    }

    if (dto.unit_number && dto.unit_number.trim().toLowerCase() !== existing.unit_number.toLowerCase()) {
      const duplicate = db.prepare(`SELECT id FROM units WHERE unit_number = ? COLLATE NOCASE AND id != ?`).get(dto.unit_number.trim(), id);
      if (duplicate) {
        throw { status: 409, message: `A unit with number "${dto.unit_number.trim()}" already exists.` };
      }
    }

    const unitNumber = dto.unit_number !== undefined ? dto.unit_number.trim() : existing.unit_number;
    const address = dto.address !== undefined ? dto.address.trim() : existing.address;
    const monthlyRent = dto.monthly_rent !== undefined ? Number(dto.monthly_rent) : existing.monthly_rent;
    const tenantName = dto.tenant_name !== undefined ? dto.tenant_name.trim() : existing.tenant_name;
    const tenantEmail = dto.tenant_email !== undefined ? (dto.tenant_email ? dto.tenant_email.trim() : null) : existing.tenant_email;
    const tenantPhone = dto.tenant_phone !== undefined ? (dto.tenant_phone ? dto.tenant_phone.trim() : null) : existing.tenant_phone;
    const graceDays = dto.grace_days !== undefined ? Number(dto.grace_days) : existing.grace_days;

    db.prepare(`
      UPDATE units
      SET unit_number = ?, address = ?, monthly_rent = ?, tenant_name = ?, tenant_email = ?, tenant_phone = ?, grace_days = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(unitNumber, address, monthlyRent, tenantName, tenantEmail, tenantPhone, graceDays, id);

    return db.prepare(`SELECT * FROM units WHERE id = ?`).get(id) as Unit;
  }

  /**
   * Archive a unit.
   */
  static archiveUnit(id: number, customDb?: any): Unit {
    const db = customDb || getDb();
    const existing = db.prepare(`SELECT * FROM units WHERE id = ?`).get(id) as Unit | undefined;
    if (!existing) {
      throw { status: 404, message: 'Unit not found.' };
    }

    db.prepare(`
      UPDATE units SET is_archived = 1, updated_at = datetime('now') WHERE id = ?
    `).run(id);

    return db.prepare(`SELECT * FROM units WHERE id = ?`).get(id) as Unit;
  }

  /**
   * Restore an archived unit.
   */
  static restoreUnit(id: number, customDb?: any): Unit {
    const db = customDb || getDb();
    const existing = db.prepare(`SELECT * FROM units WHERE id = ?`).get(id) as Unit | undefined;
    if (!existing) {
      throw { status: 404, message: 'Unit not found.' };
    }

    db.prepare(`
      UPDATE units SET is_archived = 0, updated_at = datetime('now') WHERE id = ?
    `).run(id);

    return db.prepare(`SELECT * FROM units WHERE id = ?`).get(id) as Unit;
  }
}
