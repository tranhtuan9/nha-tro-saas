import { Router } from 'express';
import * as propertyController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/tenantGuard';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt, requireRole(UserRole.LANDLORD));

router.get('/', propertyController.list);
// Chốt 6: chỉ route TẠO MỚI mới yêu cầu gói còn hiệu lực; GET/PATCH vẫn cho phép khi hết hạn.
router.post('/', requireActiveSubscription, propertyController.create);
router.get('/:id', propertyController.getById);
router.patch('/:id', propertyController.update);
router.patch('/:id/deactivate', propertyController.deactivate);

export default router;
