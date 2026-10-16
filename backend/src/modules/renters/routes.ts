import { Router } from 'express';
import * as renterController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/tenantGuard';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt, requireRole(UserRole.LANDLORD));

router.get('/', renterController.list);
// Chỉ route TẠO MỚI mới yêu cầu gói còn hiệu lực; GET/PATCH vẫn cho phép khi hết hạn.
router.post('/', requireActiveSubscription, renterController.create);
router.get('/:id', renterController.getById);
router.patch('/:id', renterController.update);
// Gửi lại lời mời cũng là TẠO MỚI token nên yêu cầu gói còn hiệu lực.
router.post('/:id/resend-invite', requireActiveSubscription, renterController.resendInvite);

export default router;
