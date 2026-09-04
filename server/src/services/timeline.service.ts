import { getDb } from '../db/database.js';
import { MaintenanceTimelineEvent } from '../types/index.js';

export class TimelineService {
  /**
   * Append an immutable audit event to the maintenance timeline.
   */
  static logEvent(
    requestId: number,
    eventType: 'created' | 'status_change' | 'assignment' | 'unassignment' | 'note' | 'details_updated',
    oldValue: string | null,
    newValue: string | null,
    userId: number,
    notes?: string | null,
    customDb?: any
  ): MaintenanceTimelineEvent {
    const db = customDb || getDb();

    const stmt = db.prepare(`
      INSERT INTO maintenance_timeline (request_id, event_type, old_value, new_value, user_id, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(requestId, eventType, oldValue, newValue, userId, notes || null);
    const eventId = result.lastInsertRowid as number;

    const event = db.prepare(`
      SELECT t.*, u.name as user_name, u.role as user_role
      FROM maintenance_timeline t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `).get(eventId) as MaintenanceTimelineEvent;

    return event;
  }

  /**
   * Retrieve the complete, chronological audit timeline for a maintenance request.
   */
  static getTimelineForRequest(requestId: number, customDb?: any): MaintenanceTimelineEvent[] {
    const db = customDb || getDb();

    const stmt = db.prepare(`
      SELECT t.*, u.name as user_name, u.role as user_role
      FROM maintenance_timeline t
      JOIN users u ON t.user_id = u.id
      WHERE t.request_id = ?
      ORDER BY t.created_at ASC, t.id ASC
    `);

    return stmt.all(requestId) as MaintenanceTimelineEvent[];
  }

  /**
   * Explicitly disallow any modification or deletion of timeline history.
   */
  static rejectMutation(): never {
    throw new Error('Audit trail violation: Maintenance timeline records are immutable and cannot be updated or deleted.');
  }
}
