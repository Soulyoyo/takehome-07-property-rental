import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Only Property Managers can view dashboard metrics
router.use(requireAuth, requireRole('property_manager'));

router.get('/', DashboardController.getDashboard);

export default router;
