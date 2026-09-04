import { Response } from 'express';
import { RentService } from '../services/rent.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export class RentController {
  static recordPayment(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const payment = RentService.recordPayment(req.body, user.userId);
      res.status(201).json({ payment, message: 'Rent payment recorded successfully.' });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to record rent payment.' });
    }
  }

  static processBulk(req: AuthenticatedRequest, res: Response): void {
    try {
      const user = req.user!;
      const { month, rows } = req.body;

      const report = RentService.processBulkRent(month, rows, user.userId);
      res.json({ report, message: 'Bulk rent batch processed successfully.' });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to process bulk rent payments.' });
    }
  }

  static getRentRoll(req: AuthenticatedRequest, res: Response): void {
    try {
      const month = req.query.month as string | undefined;
      const rentRoll = RentService.getRentRoll(month);
      res.json(rentRoll);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to fetch rent roll.' });
    }
  }

  static exportRentRollCsv(req: AuthenticatedRequest, res: Response): void {
    try {
      const month = req.query.month as string | undefined;
      const { csv, filename } = RentService.generateRentRollCsv(month);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to export rent roll CSV.' });
    }
  }
}
