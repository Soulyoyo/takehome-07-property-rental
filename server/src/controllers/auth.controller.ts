import { Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export class AuthController {
  static login(req: AuthenticatedRequest, res: Response): void {
    try {
      const { email, password } = req.body;
      const result = AuthService.login(email, password);
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Authentication failed.' });
    }
  }

  static getMe(req: AuthenticatedRequest, res: Response): void {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const user = AuthService.getUserById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user });
  }

  static listContractors(req: AuthenticatedRequest, res: Response): void {
    try {
      const contractors = AuthService.listContractors();
      res.json({ contractors });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list contractors.' });
    }
  }
}
