import { Response } from 'express';
import { MaintenanceService } from '../services/maintenance.service.js';
import { TimelineService } from '../services/timeline.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export class MaintenanceController {
  static list(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const {
        search,
        unit_id,
        status,
        contractor_id,
        priority,
        sort_by,
        sort_order,
        page,
        limit,
      } = req.query;

      const result = MaintenanceService.listRequests(user.userId, user.role, {
        search: search ? String(search) : undefined,
        unit_id: unit_id ? Number(unit_id) : undefined,
        status: status as any,
        contractor_id: contractor_id ? Number(contractor_id) : undefined,
        priority: priority as any,
        sort_by: sort_by as any,
        sort_order: sort_order as any,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
      });

      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to list maintenance requests.' });
    }
  }

  static getById(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid maintenance request ID.' });
        return;
      }

      const request = MaintenanceService.getRequestById(id, user.userId, user.role);
      if (!request) {
        res.status(404).json({ error: 'Maintenance request not found or access denied.' });
        return;
      }

      res.json({ request });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to retrieve maintenance request.' });
    }
  }

  static getTimeline(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid maintenance request ID.' });
        return;
      }

      // Check request visibility first
      const request = MaintenanceService.getRequestById(id, user.userId, user.role);
      if (!request) {
        res.status(404).json({ error: 'Maintenance request not found or access denied.' });
        return;
      }

      const timeline = TimelineService.getTimelineForRequest(id);
      res.json({ timeline });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to retrieve timeline.' });
    }
  }

  static create(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const { unit_id, title, description, priority } = req.body;

      const request = MaintenanceService.createRequest(
        { unit_id, title, description, priority },
        user.userId,
        user.name
      );

      res.status(201).json({ request, message: 'Maintenance request reported successfully.' });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to create maintenance request.' });
    }
  }

  static updateDetails(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid maintenance request ID.' });
        return;
      }

      const { title, description, priority } = req.body;
      const request = MaintenanceService.updateDetails(
        id,
        { title, description, priority },
        user.userId,
        user.role,
        user.name
      );

      res.json({ request, message: 'Request details updated successfully.' });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to update request details.' });
    }
  }

  static updateStatus(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid maintenance request ID.' });
        return;
      }

      const { status, notes } = req.body;
      if (!status) {
        res.status(400).json({ error: 'Target status is required.' });
        return;
      }

      const request = MaintenanceService.updateStatus(
        id,
        status,
        user.userId,
        user.role,
        notes
      );

      res.json({ request, message: `Request status transitioned to "${status}".` });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to update request status.' });
    }
  }

  static assignContractor(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id as string, 10);
      const { contractor_id } = req.body;

      if (isNaN(id) || !contractor_id) {
        res.status(400).json({ error: 'Valid Request ID and contractor_id are required.' });
        return;
      }

      const request = MaintenanceService.assignContractor(
        id,
        Number(contractor_id),
        user.userId
      );

      res.json({ request, message: 'Contractor assigned successfully.' });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to assign contractor.' });
    }
  }

  static unassignContractor(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id as string, 10);
      const { contractor_id } = req.body;

      if (isNaN(id) || !contractor_id) {
        res.status(400).json({ error: 'Valid Request ID and contractor_id are required.' });
        return;
      }

      const request = MaintenanceService.unassignContractor(
        id,
        Number(contractor_id),
        user.userId
      );

      res.json({ request, message: 'Contractor removed from request.' });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to unassign contractor.' });
    }
  }

  static addNote(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id as string, 10);
      const { note } = req.body;

      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid maintenance request ID.' });
        return;
      }

      MaintenanceService.addNote(id, user.userId, user.role, note);
      res.status(201).json({ message: 'Note added to audit timeline.' });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to add note.' });
    }
  }

  /**
   * Block any attempt to rewrite history.
   */
  static rejectTimelineMutation(req: AuthenticatedRequest, res: Response): void {
    res.status(405).json({
      error: 'Method Not Allowed: Audit timeline records are strictly immutable and cannot be updated or deleted.',
    });
  }
}
