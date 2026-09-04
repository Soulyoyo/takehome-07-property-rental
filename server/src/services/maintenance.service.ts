import { getDb } from '../db/database.js';
import { TimelineService } from './timeline.service.js';
import {
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenancePriority,
  UserRole,
} from '../types/index.js';

export interface CreateMaintenanceRequestDTO {
  unit_id: number;
  title: string;
  description: string;
  priority: MaintenancePriority;
}

export interface UpdateMaintenanceDetailsDTO {
  title?: string;
  description?: string;
  priority?: MaintenancePriority;
}

export interface MaintenanceFilterOptions {
  search?: string;
  unit_id?: number;
  status?: MaintenanceStatus;
  contractor_id?: number;
  priority?: MaintenancePriority;
  sort_by?: 'created_at' | 'priority' | 'status';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class MaintenanceService {
  /**
   * Helper to attach contractors to an array of maintenance requests.
   */
  private static attachContractors(requests: MaintenanceRequest[], customDb?: any): void {
    if (requests.length === 0) return;
    const db = customDb || getDb();

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
  }

  /**
   * Get a single maintenance request by ID with role check.
   */
  static getRequestById(
    requestId: number,
    userId: number,
    userRole: UserRole,
    customDb?: any
  ): MaintenanceRequest | null {
    const db = customDb || getDb();

    let query = `
      SELECT m.*, u.unit_number, u.address as unit_address, u.tenant_name, creator.name as creator_name
      FROM maintenance_requests m
      JOIN units u ON m.unit_id = u.id
      JOIN users creator ON m.created_by_user_id = creator.id
      WHERE m.id = ?
    `;

    // Contractors can ONLY see requests assigned to them
    if (userRole === 'contractor') {
      query += ` AND m.id IN (SELECT request_id FROM maintenance_contractors WHERE contractor_id = ${Number(userId)})`;
    }

    const req = db.prepare(query).get(requestId) as MaintenanceRequest | undefined;
    if (!req) return null;

    this.attachContractors([req], db);
    return req;
  }

  /**
   * List maintenance requests with server-side search, filtering, sorting, and pagination.
   * Contractors can ONLY see requests assigned to them.
   */
  static listRequests(
    userId: number,
    userRole: UserRole,
    options: MaintenanceFilterOptions = {},
    customDb?: any
  ): PaginatedResult<MaintenanceRequest> {
    const db = customDb || getDb();

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];

    // Role-based visibility scoping
    if (userRole === 'contractor') {
      whereClauses.push(`m.id IN (SELECT request_id FROM maintenance_contractors WHERE contractor_id = ?)`);
      params.push(userId);
    } else if (options.contractor_id) {
      // Property Manager filtering by specific contractor
      whereClauses.push(`m.id IN (SELECT request_id FROM maintenance_contractors WHERE contractor_id = ?)`);
      params.push(Number(options.contractor_id));
    }

    // Unit filter
    if (options.unit_id) {
      whereClauses.push(`m.unit_id = ?`);
      params.push(Number(options.unit_id));
    }

    // Status filter
    if (options.status) {
      whereClauses.push(`m.status = ?`);
      params.push(options.status);
    }

    // Priority filter
    if (options.priority) {
      whereClauses.push(`m.priority = ?`);
      params.push(options.priority);
    }

    // Text search over description and title
    if (options.search && options.search.trim()) {
      whereClauses.push(`(m.title LIKE ? OR m.description LIKE ?)`);
      const term = `%${options.search.trim()}%`;
      params.push(term, term);
    }

    const whereSql = whereClauses.join(' AND ');

    // Total count query
    const countSql = `
      SELECT COUNT(*) as count
      FROM maintenance_requests m
      JOIN units u ON m.unit_id = u.id
      WHERE ${whereSql}
    `;
    const countRow = db.prepare(countSql).get(...params) as { count: number };
    const total = countRow ? countRow.count : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Sorting
    let orderSql = 'm.created_at DESC';
    const sortOrder = options.sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    if (options.sort_by === 'priority') {
      // Order: urgent (4) > high (3) > medium (2) > low (1)
      orderSql = `CASE m.priority 
        WHEN 'urgent' THEN 4 
        WHEN 'high' THEN 3 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 1 
        ELSE 0 END ${sortOrder}, m.created_at DESC`;
    } else if (options.sort_by === 'status') {
      // Order: Reported > Triaged > Scheduled > Resolved
      orderSql = `CASE m.status 
        WHEN 'Reported' THEN 1 
        WHEN 'Triaged' THEN 2 
        WHEN 'Scheduled' THEN 3 
        WHEN 'Resolved' THEN 4 
        ELSE 5 END ${sortOrder}, m.created_at DESC`;
    } else if (options.sort_by === 'created_at') {
      orderSql = `m.created_at ${sortOrder}`;
    }

    // Data query
    const dataSql = `
      SELECT m.*, u.unit_number, u.address as unit_address, u.tenant_name, creator.name as creator_name
      FROM maintenance_requests m
      JOIN units u ON m.unit_id = u.id
      JOIN users creator ON m.created_by_user_id = creator.id
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(dataSql).all(...params, limit, offset) as MaintenanceRequest[];
    this.attachContractors(items, db);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Create a new maintenance request (can be called by manager or contractor).
   */
  static createRequest(
    dto: CreateMaintenanceRequestDTO,
    userId: number,
    userName: string,
    customDb?: any
  ): MaintenanceRequest {
    const db = customDb || getDb();

    if (!dto.unit_id) {
      throw { status: 400, message: 'Unit ID is required.' };
    }
    if (!dto.title || !dto.title.trim()) {
      throw { status: 400, message: 'Title is required.' };
    }
    if (!dto.description || !dto.description.trim()) {
      throw { status: 400, message: 'Description is required.' };
    }
    const validPriorities: MaintenancePriority[] = ['low', 'medium', 'high', 'urgent'];
    if (!dto.priority || !validPriorities.includes(dto.priority)) {
      throw { status: 400, message: `Priority must be one of: ${validPriorities.join(', ')}.` };
    }

    // Check unit existence
    const unit = db.prepare(`SELECT id, unit_number FROM units WHERE id = ?`).get(dto.unit_id);
    if (!unit) {
      throw { status: 404, message: 'Specified unit does not exist.' };
    }

    const stmt = db.prepare(`
      INSERT INTO maintenance_requests (unit_id, title, description, priority, status, created_by_user_id)
      VALUES (?, ?, ?, ?, 'Reported', ?)
    `);

    const res = stmt.run(dto.unit_id, dto.title.trim(), dto.description.trim(), dto.priority, userId);
    const requestId = res.lastInsertRowid as number;

    // Log creation in immutable audit timeline
    TimelineService.logEvent(
      requestId,
      'created',
      null,
      'Reported',
      userId,
      `Request logged by ${userName}`,
      db
    );

    const created = this.getRequestById(requestId, userId, 'property_manager', db)!;
    return created;
  }

  /**
   * Edit description and priority (can be done by manager or contractor assigned).
   */
  static updateDetails(
    requestId: number,
    dto: UpdateMaintenanceDetailsDTO,
    userId: number,
    userRole: UserRole,
    userName: string,
    customDb?: any
  ): MaintenanceRequest {
    const db = customDb || getDb();

    const existing = this.getRequestById(requestId, userId, userRole, db);
    if (!existing) {
      throw { status: 404, message: 'Maintenance request not found or access denied.' };
    }

    const title = dto.title !== undefined ? dto.title.trim() : existing.title;
    const description = dto.description !== undefined ? dto.description.trim() : existing.description;
    const priority = dto.priority !== undefined ? dto.priority : existing.priority;

    if (dto.priority && !['low', 'medium', 'high', 'urgent'].includes(dto.priority)) {
      throw { status: 400, message: 'Priority must be one of: low, medium, high, urgent.' };
    }

    const changes: string[] = [];
    if (dto.priority && dto.priority !== existing.priority) {
      changes.push(`Priority changed from ${existing.priority} to ${dto.priority}`);
    }
    if (dto.description && dto.description.trim() !== existing.description) {
      changes.push('Description updated');
    }
    if (dto.title && dto.title.trim() !== existing.title) {
      changes.push('Title updated');
    }

    db.prepare(`
      UPDATE maintenance_requests
      SET title = ?, description = ?, priority = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(title, description, priority, requestId);

    if (changes.length > 0) {
      TimelineService.logEvent(
        requestId,
        'details_updated',
        null,
        null,
        userId,
        changes.join('; '),
        db
      );
    }

    return this.getRequestById(requestId, userId, userRole, db)!;
  }

  /**
   * Strict lifecycle state transition rules.
   * Moves: Reported -> Triaged -> Scheduled -> Resolved.
   * Reopen: Resolved -> Triaged.
   * Rule: Cannot move to Scheduled without assigned contractor.
   * Any other transition is rejected with explanatory message.
   */
  static updateStatus(
    requestId: number,
    newStatus: MaintenanceStatus,
    userId: number,
    userRole: UserRole,
    notes?: string,
    customDb?: any
  ): MaintenanceRequest {
    const db = customDb || getDb();

    const existing = this.getRequestById(requestId, userId, userRole, db);
    if (!existing) {
      throw { status: 404, message: 'Maintenance request not found or access denied.' };
    }

    const currentStatus = existing.status;

    if (currentStatus === newStatus) {
      throw { status: 422, message: `Invalid move: Request is already in "${currentStatus}" status.` };
    }

    // Validate lifecycle transitions
    if (currentStatus === 'Reported') {
      if (newStatus !== 'Triaged') {
        throw {
          status: 422,
          message: `Illegal transition: Cannot move from "Reported" to "${newStatus}". A newly reported request must first be triaged.`,
        };
      }
    } else if (currentStatus === 'Triaged') {
      if (newStatus === 'Reported') {
        throw {
          status: 422,
          message: `Illegal transition: Cannot move backward from "Triaged" to "Reported".`,
        };
      }
      if (newStatus === 'Resolved') {
        throw {
          status: 422,
          message: `Illegal transition: Cannot jump directly from "Triaged" to "Resolved". Work must be scheduled and performed.`,
        };
      }
      if (newStatus === 'Scheduled') {
        // Strict Rule: MUST have at least one assigned contractor before moving to Scheduled!
        const contractorCountRow = db.prepare(`
          SELECT COUNT(*) as count FROM maintenance_contractors WHERE request_id = ?
        `).get(requestId) as { count: number };

        if (!contractorCountRow || contractorCountRow.count === 0) {
          throw {
            status: 422,
            message: `Illegal transition: Cannot move into "Scheduled" status without an assigned contractor. Please assign a contractor first.`,
          };
        }
      }
    } else if (currentStatus === 'Scheduled') {
      if (newStatus === 'Reported' || newStatus === 'Triaged') {
        throw {
          status: 422,
          message: `Illegal transition: Cannot move backward from "Scheduled" to "${newStatus}". Work is already scheduled.`,
        };
      }
      // Scheduled -> Resolved is valid
    } else if (currentStatus === 'Resolved') {
      // Strict Rule: A Resolved request can be reopened, which returns it to Triaged rather than to Reported.
      if (newStatus === 'Reported') {
        throw {
          status: 422,
          message: `Illegal transition: Reopened requests must return to "Triaged" status rather than to "Reported".`,
        };
      }
      if (newStatus === 'Scheduled') {
        throw {
          status: 422,
          message: `Illegal transition: Cannot move from "Resolved" directly to "Scheduled". Please reopen to "Triaged" first for re-evaluation.`,
        };
      }
      // Resolved -> Triaged is valid (Reopen)
    }

    // Perform status update
    db.prepare(`
      UPDATE maintenance_requests
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, requestId);

    // Log status change event in immutable timeline
    const eventNote = currentStatus === 'Resolved' && newStatus === 'Triaged'
      ? `Request reopened from Resolved to Triaged${notes ? ': ' + notes : ''}`
      : notes || null;

    TimelineService.logEvent(
      requestId,
      'status_change',
      currentStatus,
      newStatus,
      userId,
      eventNote,
      db
    );

    return this.getRequestById(requestId, userId, userRole, db)!;
  }

  /**
   * Assign a contractor to a request. (Property Manager only)
   */
  static assignContractor(
    requestId: number,
    contractorId: number,
    managerId: number,
    customDb?: any
  ): MaintenanceRequest {
    const db = customDb || getDb();

    const request = db.prepare(`SELECT * FROM maintenance_requests WHERE id = ?`).get(requestId) as MaintenanceRequest | undefined;
    if (!request) {
      throw { status: 404, message: 'Maintenance request not found.' };
    }

    const contractor = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'contractor'`).get(contractorId) as any;
    if (!contractor) {
      throw { status: 404, message: 'Contractor not found or user is not a contractor.' };
    }

    const existing = db.prepare(`
      SELECT 1 FROM maintenance_contractors WHERE request_id = ? AND contractor_id = ?
    `).get(requestId, contractorId);

    if (existing) {
      throw { status: 409, message: `Contractor "${contractor.name}" is already assigned to this request.` };
    }

    db.prepare(`
      INSERT INTO maintenance_contractors (request_id, contractor_id, assigned_by_user_id)
      VALUES (?, ?, ?)
    `).run(requestId, contractorId, managerId);

    // Log assignment event in immutable audit timeline
    TimelineService.logEvent(
      requestId,
      'assignment',
      null,
      contractor.name,
      managerId,
      `Assigned contractor ${contractor.name} (${contractor.specialty || 'General'})`,
      db
    );

    return this.getRequestById(requestId, managerId, 'property_manager', db)!;
  }

  /**
   * Unassign a contractor from a request. (Property Manager only)
   */
  static unassignContractor(
    requestId: number,
    contractorId: number,
    managerId: number,
    customDb?: any
  ): MaintenanceRequest {
    const db = customDb || getDb();

    const request = db.prepare(`SELECT * FROM maintenance_requests WHERE id = ?`).get(requestId) as MaintenanceRequest | undefined;
    if (!request) {
      throw { status: 404, message: 'Maintenance request not found.' };
    }

    const contractor = db.prepare(`SELECT * FROM users WHERE id = ?`).get(contractorId) as any;
    if (!contractor) {
      throw { status: 404, message: 'Contractor not found.' };
    }

    const existing = db.prepare(`
      SELECT 1 FROM maintenance_contractors WHERE request_id = ? AND contractor_id = ?
    `).get(requestId, contractorId);

    if (!existing) {
      throw { status: 404, message: 'This contractor is not currently assigned to this request.' };
    }

    db.prepare(`
      DELETE FROM maintenance_contractors WHERE request_id = ? AND contractor_id = ?
    `).run(requestId, contractorId);

    // Log unassignment event in immutable audit timeline
    TimelineService.logEvent(
      requestId,
      'unassignment',
      contractor.name,
      null,
      managerId,
      `Removed contractor ${contractor.name} from request`,
      db
    );

    return this.getRequestById(requestId, managerId, 'property_manager', db)!;
  }

  /**
   * Add an immutable note to a request. (Manager or Contractor)
   */
  static addNote(
    requestId: number,
    userId: number,
    userRole: UserRole,
    noteText: string,
    customDb?: any
  ): void {
    const db = customDb || getDb();

    if (!noteText || !noteText.trim()) {
      throw { status: 400, message: 'Note text cannot be empty.' };
    }

    const request = this.getRequestById(requestId, userId, userRole, db);
    if (!request) {
      throw { status: 404, message: 'Maintenance request not found or access denied.' };
    }

    TimelineService.logEvent(
      requestId,
      'note',
      null,
      null,
      userId,
      noteText.trim(),
      db
    );
  }
}
