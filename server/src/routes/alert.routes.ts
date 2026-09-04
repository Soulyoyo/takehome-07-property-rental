import { Router } from 'express';
import { AlertController } from '../controllers/alert.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Only Property Managers can view/dismiss alerts
router.use(requireAuth, requireRole('property_manager'));

router.get('/', AlertController.list);
router.get('/count', AlertController.getCount);
router.post('/:unitId/dismiss', AlertController.dismiss);

export default router;
