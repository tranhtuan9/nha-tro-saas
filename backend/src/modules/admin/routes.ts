import { Router } from 'express';
import * as adminController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt, requireRole(UserRole.ADMIN));

router.get('/users', adminController.getUsers);
router.patch('/users/:id/lock', adminController.lockUser);
router.patch('/users/:id/unlock', adminController.unlockUser);

router.get('/tenants', adminController.getTenants);
router.patch('/tenants/:id/suspend', adminController.suspendTenant);
router.patch('/tenants/:id/activate', adminController.activateTenant);
router.patch('/tenants/:id/plan', adminController.changeTenantPlan);

router.get('/plans', adminController.getPlans);
router.patch('/plans/:id', adminController.updatePlan);
router.patch('/plans/:id/deactivate', adminController.deactivatePlan);

export default router;
