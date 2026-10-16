import { Router } from 'express';
import * as contractController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/tenantGuard';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt, requireRole(UserRole.LANDLORD));

router.get('/', contractController.list);
// Chỉ route TẠO MỚI mới yêu cầu gói còn hiệu lực; GET/PATCH vẫn cho phép khi hết hạn.
router.post('/', requireActiveSubscription, contractController.create);
router.get('/:id', contractController.getById);
router.patch('/:id', contractController.update);
router.patch('/:id/terminate', contractController.terminate);
router.patch('/:id/end', contractController.end);

export default router;
