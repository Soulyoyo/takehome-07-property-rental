import { Router } from 'express';
import { UnitController } from '../controllers/unit.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Only Property Managers can view/manage units
router.use(requireAuth, requireRole('property_manager'));

router.get('/', UnitController.list);
router.post('/', UnitController.create);
router.get('/:id', UnitController.getById);
router.put('/:id', UnitController.update);
router.post('/:id/archive', UnitController.archive);
router.post('/:id/restore', UnitController.restore);

export default router;
