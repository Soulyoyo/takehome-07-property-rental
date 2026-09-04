import { Router } from 'express';
import { RentController } from '../controllers/rent.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Only Property Managers can view or record rent data
router.use(requireAuth, requireRole('property_manager'));

router.post('/payments', RentController.recordPayment);
router.post('/bulk', RentController.processBulk);
router.get('/roll', RentController.getRentRoll);
router.get('/roll/export', RentController.exportRentRollCsv);

export default router;
