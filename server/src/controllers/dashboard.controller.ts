import { Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export class DashboardController {
  static getDashboard(req: AuthenticatedRequest, res: Response): void {
    try {
      const metrics = DashboardService.getMetrics();
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch dashboard metrics.' });
    }
  }
}
