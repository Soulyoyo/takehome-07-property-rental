import { Response } from 'express';
import { UnitService } from '../services/unit.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export class UnitController {
  static list(req: AuthenticatedRequest, res: Response): void {
    try {
      const includeArchived = req.query.include_archived === 'true';
      const units = UnitService.listUnits(includeArchived);
      res.json({ units });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list units.' });
    }
  }

  static getById(req: AuthenticatedRequest, res: Response): void {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid unit ID.' });
        return;
      }
      const unit = UnitService.getUnitById(id);
      if (!unit) {
        res.status(404).json({ error: 'Unit not found.' });
        return;
      }
      res.json({ unit });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to retrieve unit.' });
    }
  }

  static create(req: AuthenticatedRequest, res: Response): void {
    try {
      const unit = UnitService.createUnit(req.body);
      res.status(201).json({ unit, message: 'Unit created successfully.' });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to create unit.' });
    }
  }

  static update(req: AuthenticatedRequest, res: Response): void {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid unit ID.' });
        return;
      }
      const unit = UnitService.updateUnit(id, req.body);
      res.json({ unit, message: 'Unit updated successfully.' });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to update unit.' });
    }
  }

  static archive(req: AuthenticatedRequest, res: Response): void {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid unit ID.' });
        return;
      }
      const unit = UnitService.archiveUnit(id);
      res.json({ unit, message: `Unit ${unit.unit_number} has been archived.` });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to archive unit.' });
    }
  }

  static restore(req: AuthenticatedRequest, res: Response): void {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid unit ID.' });
        return;
      }
      const unit = UnitService.restoreUnit(id);
      res.json({ unit, message: `Unit ${unit.unit_number} has been restored.` });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to restore unit.' });
    }
  }
}
