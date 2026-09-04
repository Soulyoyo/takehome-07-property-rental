import { getDb } from '../db/database.js';
import {
  RentPayment,
  BulkRentRowInput,
  BulkRentReport,
  BulkRentRowResult,
  RentRollItem,
  Unit,
} from '../types/index.js';

export interface RecordPaymentDTO {
  unit_id: number;
  amount: number;
  month: string; // 'YYYY-MM'
  payment_method?: string;
  notes?: string;
}

export class RentService {
  /**
   * Validate 'YYYY-MM' format.
   */
  static isValidMonth(month: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  }

  /**
   * Record a single rent payment. (Property Manager only)
   */
  static recordPayment(
    dto: RecordPaymentDTO,
    recordedByUserId: number,
    customDb?: any
  ): RentPayment {
    const db = customDb || getDb();

    if (!dto.unit_id) {
      throw { status: 400, message: 'Unit ID is required.' };
    }
    if (dto.amount === undefined || dto.amount === null || dto.amount <= 0) {
      throw { status: 400, message: 'Payment amount must be greater than zero.' };
    }
    if (!dto.month || !this.isValidMonth(dto.month)) {
      throw { status: 400, message: 'Month must be in YYYY-MM format (e.g. 2026-09).' };
    }

    const unit = db.prepare(`SELECT * FROM units WHERE id = ?`).get(dto.unit_id) as Unit | undefined;
    if (!unit) {
      throw { status: 404, message: 'Unit not found.' };
    }

    const stmt = db.prepare(`
      INSERT INTO rent_payments (unit_id, amount, month, payment_method, recorded_by_user_id, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      dto.unit_id,
      Number(dto.amount),
      dto.month,
      dto.payment_method?.trim() || 'Bank Transfer',
      recordedByUserId,
      dto.notes?.trim() || null
    );

    return db.prepare(`
      SELECT p.*, u.name as recorded_by_name
      FROM rent_payments p
      JOIN users u ON p.recorded_by_user_id = u.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid) as RentPayment;
  }

  /**
   * Bulk-record rent payments received for a given month in one atomic batch.
   * Classifies each row as:
   *  - matched: amount == unit's monthly rent
   *  - underpaid: amount < unit's monthly rent
   *  - overpaid: amount > unit's monthly rent
   *  - unmatched: identifier does not correspond to any unit
   */
  static processBulkRent(
    month: string,
    rows: BulkRentRowInput[],
    recordedByUserId: number,
    customDb?: any
  ): BulkRentReport {
    const db = customDb || getDb();

    if (!month || !this.isValidMonth(month)) {
      throw { status: 400, message: 'A valid month in YYYY-MM format is required for bulk rent.' };
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      throw { status: 400, message: 'At least one rent payment row is required.' };
    }

    // Load all units for fast lookup by unit_number and id
    const allUnits = db.prepare(`SELECT * FROM units`).all() as Unit[];
    const unitsByNumber = new Map<string, Unit>();
    const unitsById = new Map<number, Unit>();

    for (const u of allUnits) {
      unitsByNumber.set(u.unit_number.toLowerCase().trim(), u);
      unitsById.set(u.id, u);
    }

    const results: BulkRentRowResult[] = [];
    let matchedCount = 0;
    let underpaidCount = 0;
    let overpaidCount = 0;
    let unmatchedCount = 0;
    let totalCollected = 0;

    const insertPayment = db.prepare(`
      INSERT INTO rent_payments (unit_id, amount, month, payment_method, recorded_by_user_id, notes)
      VALUES (?, ?, ?, 'Bulk Upload', ?, ?)
    `);

    // Execute in transaction
    const executeBatch = db.transaction(() => {
      let rowIndex = 1;
      for (const row of rows) {
        const identifierStr = String(row.identifier || '').trim();
        const amount = Number(row.amount);

        // Try matching by unit_number first, then by numeric id
        let matchedUnit: Unit | undefined = unitsByNumber.get(identifierStr.toLowerCase());
        if (!matchedUnit && /^\d+$/.test(identifierStr)) {
          matchedUnit = unitsById.get(parseInt(identifierStr, 10));
        }

        if (!matchedUnit) {
          unmatchedCount++;
          results.push({
            row: rowIndex++,
            identifier: identifierStr,
            amount_received: isNaN(amount) ? 0 : amount,
            classification: 'unmatched',
            message: `No unit found matching identifier "${identifierStr}". Payment not recorded.`,
          });
          continue;
        }

        if (isNaN(amount) || amount <= 0) {
          unmatchedCount++;
          results.push({
            row: rowIndex++,
            identifier: identifierStr,
            unit_id: matchedUnit.id,
            unit_number: matchedUnit.unit_number,
            tenant_name: matchedUnit.tenant_name,
            monthly_rent: matchedUnit.monthly_rent,
            amount_received: 0,
            classification: 'unmatched',
            message: `Invalid amount "${row.amount}". Amount must be greater than zero.`,
          });
          continue;
        }

        // Record the payment
        insertPayment.run(
          matchedUnit.id,
          amount,
          month,
          recordedByUserId,
          row.notes ? `Bulk batch: ${row.notes}` : 'Bulk payment recording'
        );
        totalCollected += amount;

        // Classify against unit's monthly rent
        const monthlyRent = matchedUnit.monthly_rent;
        if (Math.abs(amount - monthlyRent) < 0.001) {
          matchedCount++;
          results.push({
            row: rowIndex++,
            identifier: identifierStr,
            unit_id: matchedUnit.id,
            unit_number: matchedUnit.unit_number,
            tenant_name: matchedUnit.tenant_name,
            monthly_rent: monthlyRent,
            amount_received: amount,
            classification: 'matched',
            message: `Payment exactly matches monthly rent ($${monthlyRent.toFixed(2)}).`,
          });
        } else if (amount < monthlyRent) {
          underpaidCount++;
          results.push({
            row: rowIndex++,
            identifier: identifierStr,
            unit_id: matchedUnit.id,
            unit_number: matchedUnit.unit_number,
            tenant_name: matchedUnit.tenant_name,
            monthly_rent: monthlyRent,
            amount_received: amount,
            classification: 'underpaid',
            message: `Short by $${(monthlyRent - amount).toFixed(2)} (received $${amount.toFixed(2)} of $${monthlyRent.toFixed(2)}).`,
          });
        } else {
          overpaidCount++;
          results.push({
            row: rowIndex++,
            identifier: identifierStr,
            unit_id: matchedUnit.id,
            unit_number: matchedUnit.unit_number,
            tenant_name: matchedUnit.tenant_name,
            monthly_rent: monthlyRent,
            amount_received: amount,
            classification: 'overpaid',
            message: `Exceeds monthly rent by $${(amount - monthlyRent).toFixed(2)} (received $${amount.toFixed(2)} of $${monthlyRent.toFixed(2)}).`,
          });
        }
      }
    });

    executeBatch();

    return {
      month,
      total_processed: rows.length,
      matched_count: matchedCount,
      underpaid_count: underpaidCount,
      overpaid_count: overpaidCount,
      unmatched_count: unmatchedCount,
      total_collected: totalCollected,
      results,
    };
  }

  /**
   * Get the rent roll for a given month across all active units.
   */
  static getRentRoll(month?: string, customDb?: any): { month: string; items: RentRollItem[]; summary: any } {
    const db = customDb || getDb();

    const targetMonth = month && this.isValidMonth(month)
      ? month
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Get all active units
    const units = db.prepare(`
      SELECT id, unit_number, address, tenant_name, monthly_rent
      FROM units
      WHERE is_archived = 0
      ORDER BY unit_number ASC
    `).all() as Array<{ id: number; unit_number: string; address: string; tenant_name: string; monthly_rent: number }>;

    // Get payments for targetMonth
    const paymentSums = db.prepare(`
      SELECT unit_id, SUM(amount) as total_paid, MAX(paid_at) as last_payment_date
      FROM rent_payments
      WHERE month = ?
      GROUP BY unit_id
    `).all(targetMonth) as Array<{ unit_id: number; total_paid: number; last_payment_date: string }>;

    const paymentMap = new Map<number, { total_paid: number; last_payment_date: string }>();
    for (const p of paymentSums) {
      paymentMap.set(p.unit_id, { total_paid: p.total_paid, last_payment_date: p.last_payment_date });
    }

    let totalExpectedRent = 0;
    let totalCollectedRent = 0;
    let totalBalanceDue = 0;

    const items: RentRollItem[] = units.map(u => {
      const p = paymentMap.get(u.id);
      const amountPaid = p ? p.total_paid : 0;
      const balanceDue = Math.max(0, u.monthly_rent - amountPaid);

      totalExpectedRent += u.monthly_rent;
      totalCollectedRent += amountPaid;
      totalBalanceDue += balanceDue;

      let status: 'paid' | 'underpaid' | 'overpaid' | 'unpaid' = 'unpaid';
      if (amountPaid === 0) {
        status = 'unpaid';
      } else if (Math.abs(amountPaid - u.monthly_rent) < 0.001) {
        status = 'paid';
      } else if (amountPaid < u.monthly_rent) {
        status = 'underpaid';
      } else {
        status = 'overpaid';
      }

      return {
        unit_id: u.id,
        unit_number: u.unit_number,
        address: u.address,
        tenant_name: u.tenant_name,
        monthly_rent: u.monthly_rent,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        status,
        last_payment_date: p ? p.last_payment_date : null,
      };
    });

    return {
      month: targetMonth,
      items,
      summary: {
        total_units: units.length,
        total_expected_rent: totalExpectedRent,
        total_collected_rent: totalCollectedRent,
        total_balance_due: totalBalanceDue,
        collection_rate: totalExpectedRent > 0 ? (totalCollectedRent / totalExpectedRent) * 100 : 0,
      },
    };
  }

  /**
   * Generate CSV format for the rent roll.
   */
  static generateRentRollCsv(month?: string, customDb?: any): { csv: string; filename: string } {
    const data = this.getRentRoll(month, customDb);

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Unit Number',
      'Address',
      'Tenant Name',
      'Monthly Rent',
      'Amount Paid',
      'Balance Due',
      'Payment Status',
      'Last Payment Date',
      'Month',
    ];

    const lines = [headers.join(',')];

    for (const item of data.items) {
      lines.push([
        escapeCsv(item.unit_number),
        escapeCsv(item.address),
        escapeCsv(item.tenant_name),
        item.monthly_rent.toFixed(2),
        item.amount_paid.toFixed(2),
        item.balance_due.toFixed(2),
        escapeCsv(item.status.toUpperCase()),
        escapeCsv(item.last_payment_date || 'N/A'),
        escapeCsv(data.month),
      ].join(','));
    }

    // Add summary row
    lines.push('');
    lines.push([
      escapeCsv('TOTALS'),
      escapeCsv(`Total Units: ${data.summary.total_units}`),
      escapeCsv(''),
      data.summary.total_expected_rent.toFixed(2),
      data.summary.total_collected_rent.toFixed(2),
      data.summary.total_balance_due.toFixed(2),
      escapeCsv(`Collection Rate: ${data.summary.collection_rate.toFixed(1)}%`),
      escapeCsv(''),
      escapeCsv(data.month),
    ].join(','));

    return {
      csv: lines.join('\r\n'),
      filename: `rent-roll-${data.month}.csv`,
    };
  }
}
