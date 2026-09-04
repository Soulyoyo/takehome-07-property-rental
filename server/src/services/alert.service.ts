import { getDb } from '../db/database.js';
import { OverdueAlert, Unit } from '../types/index.js';

export class AlertService {
  /**
   * Helper to format current month 'YYYY-MM'
   */
  static getCurrentMonthStr(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get all active overdue rent alerts.
   * If a month is not provided, defaults to current month.
   */
  static getOverdueAlerts(month?: string, customDb?: any): OverdueAlert[] {
    const db = customDb || getDb();
    const now = new Date();
    const currentMonth = month || this.getCurrentMonthStr();
    const currentDay = now.getDate();

    // Check if target month is current month, past month, or future month
    const [targetYear, targetMonthNum] = currentMonth.split('-').map(Number);
    const isCurrentMonth = targetYear === now.getFullYear() && targetMonthNum === (now.getMonth() + 1);
    const isPastMonth = targetYear < now.getFullYear() || (targetYear === now.getFullYear() && targetMonthNum < (now.getMonth() + 1));

    // Future months cannot be overdue
    if (!isCurrentMonth && !isPastMonth) {
      return [];
    }

    // Query active units
    const units = db.prepare(`
      SELECT * FROM units WHERE is_archived = 0 ORDER BY unit_number ASC
    `).all() as Unit[];

    // Query total paid per unit for the target month
    const payments = db.prepare(`
      SELECT unit_id, SUM(amount) as total_paid
      FROM rent_payments
      WHERE month = ?
      GROUP BY unit_id
    `).all(currentMonth) as Array<{ unit_id: number; total_paid: number }>;

    const paidMap = new Map<number, number>();
    for (const p of payments) {
      paidMap.set(p.unit_id, p.total_paid);
    }

    // Query dismissals for this specific unit and month
    const dismissals = db.prepare(`
      SELECT unit_id FROM rent_alert_dismissals WHERE month = ?
    `).all(currentMonth) as Array<{ unit_id: number }>;

    const dismissedUnitIds = new Set(dismissals.map(d => d.unit_id));

    const alerts: OverdueAlert[] = [];

    for (const unit of units) {
      const graceDays = unit.grace_days !== undefined ? unit.grace_days : 5;

      // Grace period check:
      // If current month: overdue only if currentDay > graceDays (e.g. grace is 5 days, so day 6 onwards)
      // If past month: grace period has definitely elapsed
      const isPastGracePeriod = isPastMonth || (isCurrentMonth && currentDay > graceDays);
      if (!isPastGracePeriod) {
        continue;
      }

      const amountPaid = paidMap.get(unit.id) || 0;
      const amountDue = unit.monthly_rent - amountPaid;

      // Only alert if unpaid or underpaid (tolerance for floating point)
      if (amountDue > 0.009) {
        const isDismissed = dismissedUnitIds.has(unit.id);
        if (!isDismissed) {
          const daysOverdue = isPastMonth
            ? 30
            : Math.max(1, currentDay - graceDays);

          alerts.push({
            unit_id: unit.id,
            unit_number: unit.unit_number,
            address: unit.address,
            tenant_name: unit.tenant_name,
            monthly_rent: unit.monthly_rent,
            amount_paid: amountPaid,
            amount_due: amountDue,
            month: currentMonth,
            grace_days: graceDays,
            days_overdue: daysOverdue,
            is_dismissed: false,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Count active alerts for the navigation badge.
   */
  static getAlertCount(month?: string, customDb?: any): number {
    return this.getOverdueAlerts(month, customDb).length;
  }

  /**
   * Dismiss an alert for a unit in a specific month.
   * If in a later month the rent remains unpaid, the alert will return!
   */
  static dismissAlert(
    unitId: number,
    month: string | undefined,
    userId: number,
    customDb?: any
  ): { success: boolean; message: string; unit_id: number; month: string } {
    const db = customDb || getDb();
    const targetMonth = month || this.getCurrentMonthStr();

    const unit = db.prepare(`SELECT * FROM units WHERE id = ?`).get(unitId) as Unit | undefined;
    if (!unit) {
      throw { status: 404, message: 'Unit not found.' };
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO rent_alert_dismissals (unit_id, month, dismissed_by_user_id, dismissed_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    stmt.run(unitId, targetMonth, userId);

    return {
      success: true,
      message: `Overdue rent alert for Unit ${unit.unit_number} (${targetMonth}) dismissed. If rent is unpaid in future months, a new alert will appear.`,
      unit_id: unitId,
      month: targetMonth,
    };
  }
}
