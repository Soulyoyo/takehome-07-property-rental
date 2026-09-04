import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', AuthController.login);
router.get('/me', requireAuth, AuthController.getMe);
router.get('/contractors', requireAuth, AuthController.listContractors);

export default router;
