import { Router } from 'express';
import * as roomController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/tenantGuard';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt);

// GET: Landlord và Renter (UC27 - Renter chỉ thấy phòng thuộc hợp đồng của mình nhờ RLS).
router.get('/', requireRole(UserRole.LANDLORD, UserRole.RENTER), roomController.list);
router.get('/:id', requireRole(UserRole.LANDLORD, UserRole.RENTER), roomController.getById);

// Ghi/sửa: chỉ Landlord.
// Chốt 6: chỉ route TẠO MỚI mới yêu cầu gói còn hiệu lực; GET/PATCH vẫn cho phép khi hết hạn.
router.post(
  '/',
  requireRole(UserRole.LANDLORD),
  requireActiveSubscription,
  roomController.create
);
router.patch('/:id', requireRole(UserRole.LANDLORD), roomController.update);
router.patch('/:id/status', requireRole(UserRole.LANDLORD), roomController.updateStatus);

export default router;
