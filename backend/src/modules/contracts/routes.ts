import { Router } from 'express';
import * as contractController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/tenantGuard';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt);

// GET: Landlord và Renter (UC28 - Renter chỉ thấy hợp đồng của mình nhờ RLS).
router.get('/', requireRole(UserRole.LANDLORD, UserRole.RENTER), contractController.list);
router.get('/:id', requireRole(UserRole.LANDLORD, UserRole.RENTER), contractController.getById);

// Ghi/sửa: chỉ Landlord.
// Chỉ route TẠO MỚI mới yêu cầu gói còn hiệu lực; GET/PATCH vẫn cho phép khi hết hạn.
router.post(
  '/',
  requireRole(UserRole.LANDLORD),
  requireActiveSubscription,
  contractController.create
);
router.patch('/:id', requireRole(UserRole.LANDLORD), contractController.update);
router.patch('/:id/terminate', requireRole(UserRole.LANDLORD), contractController.terminate);
router.patch('/:id/end', requireRole(UserRole.LANDLORD), contractController.end);

export default router;
