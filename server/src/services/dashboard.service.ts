import { getDb } from '../db/database.js';
import { DashboardMetrics, MaintenanceStatus } from '../types/index.js';
import { AlertService } from './alert.service.js';

export class DashboardService {
  static getMetrics(customDb?: any): DashboardMetrics {
    const db = customDb || getDb();
    const currentMonth = AlertService.getCurrentMonthStr();

    // 1. Open maintenance requests (Reported, Triaged, Scheduled)
    const openReqRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM maintenance_requests
      WHERE status IN ('Reported', 'Triaged', 'Scheduled')
    `).get() as { count: number };
    const openRequests = openReqRow ? openReqRow.count : 0;

    // 2. Units with rent overdue this month
    const overdueUnits = AlertService.getAlertCount(currentMonth, db);

    // 3. Requests resolved this week (past 7 days)
    // Checking timeline events for transitions to Resolved in last 7 days
    const resolvedWeekRow = db.prepare(`
      SELECT COUNT(DISTINCT request_id) as count
      FROM maintenance_timeline
      WHERE event_type = 'status_change'
        AND new_value = 'Resolved'
        AND created_at >= datetime('now', '-7 days')
    `).get() as { count: number };
    const resolvedThisWeek = resolvedWeekRow ? resolvedWeekRow.count : 0;

    // 4. Total rent collected this month
    const rentCollectedRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM rent_payments
      WHERE month = ?
    `).get(currentMonth) as { total: number };
    const totalRentCollected = rentCollectedRow ? rentCollectedRow.total : 0;

    // 5. Breakdown by status
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM maintenance_requests
      GROUP BY status
    `).all() as Array<{ status: MaintenanceStatus; count: number }>;

    const requestsByStatus: Record<MaintenanceStatus, number> = {
      Reported: 0,
      Triaged: 0,
      Scheduled: 0,
      Resolved: 0,
    };
    for (const row of statusCounts) {
      if (requestsByStatus[row.status] !== undefined) {
        requestsByStatus[row.status] = row.count;
      }
    }

    // 6. Breakdown by contractor
    const contractorCounts = db.prepare(`
      SELECT 
        u.id as contractor_id,
        u.name as contractor_name,
        u.specialty,
        COUNT(mc.request_id) as assigned_count
      FROM users u
      LEFT JOIN maintenance_contractors mc ON u.id = mc.contractor_id
      LEFT JOIN maintenance_requests m ON mc.request_id = m.id AND m.status IN ('Reported', 'Triaged', 'Scheduled')
      WHERE u.role = 'contractor'
      GROUP BY u.id
      ORDER BY assigned_count DESC, u.name ASC
    `).all() as Array<{
      contractor_id: number;
      contractor_name: string;
      specialty?: string | null;
      assigned_count: number;
    }>;

    // 7. Chart: Requests resolved per week over the last eight weeks
    const resolvedPerWeek: Array<{
      week_label: string;
      week_start: string;
      week_end: string;
      count: number;
    }> = [];

    const now = new Date();
    // 8 weekly buckets from oldest (8 weeks ago) to most recent (this week)
    for (let i = 7; i >= 0; i--) {
      const startDaysAgo = (i + 1) * 7;
      const endDaysAgo = i * 7;

      const startDate = new Date(now.getTime() - startDaysAgo * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() - endDaysAgo * 24 * 60 * 60 * 1000);

      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      const countRow = db.prepare(`
        SELECT COUNT(DISTINCT request_id) as count
        FROM maintenance_timeline
        WHERE event_type = 'status_change'
          AND new_value = 'Resolved'
          AND created_at >= ? AND created_at < ?
      `).get(startIso, endIso) as { count: number };

      const formatLabel = (d: Date) => `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const label = i === 0 ? 'This Week' : `${formatLabel(startDate)} - ${formatLabel(endDate)}`;

      resolvedPerWeek.push({
        week_label: label,
        week_start: startIso,
        week_end: endIso,
        count: countRow ? countRow.count : 0,
      });
    }

    return {
      open_maintenance_requests: openRequests,
      units_with_rent_overdue: overdueUnits,
      requests_resolved_this_week: resolvedThisWeek,
      total_rent_collected_this_month: totalRentCollected,
      current_month: currentMonth,
      requests_by_status: requestsByStatus,
      requests_by_contractor: contractorCounts,
      resolved_per_week: resolvedPerWeek,
    };
  }
}
