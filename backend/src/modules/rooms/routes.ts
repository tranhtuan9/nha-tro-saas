import { Router } from 'express';
import * as roomController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/tenantGuard';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt, requireRole(UserRole.LANDLORD));

router.get('/', roomController.list);
// Chốt 6: chỉ route TẠO MỚI mới yêu cầu gói còn hiệu lực; GET/PATCH vẫn cho phép khi hết hạn.
router.post('/', requireActiveSubscription, roomController.create);
router.get('/:id', roomController.getById);
router.patch('/:id', roomController.update);
router.patch('/:id/status', roomController.updateStatus);

export default router;
