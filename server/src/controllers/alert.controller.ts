import { Response } from 'express';
import { AlertService } from '../services/alert.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export class AlertController {
  static list(req: AuthenticatedRequest, res: Response): void {
    try {
      const month = req.query.month as string | undefined;
      const alerts = AlertService.getOverdueAlerts(month);
      res.json({ alerts, count: alerts.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch overdue alerts.' });
    }
  }

  static getCount(req: AuthenticatedRequest, res: Response): void {
    try {
      const month = req.query.month as string | undefined;
      const count = AlertService.getAlertCount(month);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get alert count.' });
    }
  }

  static dismiss(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const unitId = parseInt(req.params.unitId as string, 10);
      const { month } = req.body;

      if (isNaN(unitId)) {
        res.status(400).json({ error: 'Invalid unit ID.' });
        return;
      }

      const result = AlertService.dismissAlert(unitId, month, user.userId);
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to dismiss alert.' });
    }
  }
}
