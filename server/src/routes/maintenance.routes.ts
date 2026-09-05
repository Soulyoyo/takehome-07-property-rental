import { Router } from 'express';
import { MaintenanceController } from '../controllers/maintenance.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// List & Search (scoped by role inside controller)
router.get('/', MaintenanceController.list);

// Unit options for reporting requests (accessible to all authenticated users)
router.get('/unit-options', MaintenanceController.getUnitOptions);

// Create request (manager or contractor)
router.post('/', MaintenanceController.create);

// Get single request
router.get('/:id', MaintenanceController.getById);

// Update description and priority
router.patch('/:id/details', MaintenanceController.updateDetails);

// Update lifecycle status (Reported -> Triaged -> Scheduled -> Resolved)
router.patch('/:id/status', MaintenanceController.updateStatus);

// Contractor assignments (Property Manager ONLY)
router.post('/:id/assign', requireRole('property_manager'), MaintenanceController.assignContractor);
router.post('/:id/unassign', requireRole('property_manager'), MaintenanceController.unassignContractor);

// Immutable Timeline (Read-only; rejects PUT/PATCH/DELETE)
router.get('/:id/timeline', MaintenanceController.getTimeline);
router.put('/:id/timeline', MaintenanceController.rejectTimelineMutation);
router.patch('/:id/timeline', MaintenanceController.rejectTimelineMutation);
router.delete('/:id/timeline', MaintenanceController.rejectTimelineMutation);

// Add note to request
router.post('/:id/notes', MaintenanceController.addNote);

export default router;
