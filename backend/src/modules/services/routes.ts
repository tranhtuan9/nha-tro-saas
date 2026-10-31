import { Router } from 'express';
import * as serviceController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/tenantGuard';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt, requireRole(UserRole.LANDLORD));

router.get('/', serviceController.list);
// Chỉ route TẠO MỚI mới yêu cầu gói còn hiệu lực; GET/PATCH vẫn cho phép khi hết hạn.
router.post('/', requireActiveSubscription, serviceController.create);
router.get('/:id', serviceController.getById);
router.patch('/:id', serviceController.update);
router.patch('/:id/deactivate', serviceController.deactivate);
router.patch('/:id/activate', serviceController.activate);

export default router;
