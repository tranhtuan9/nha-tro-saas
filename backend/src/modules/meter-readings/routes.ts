import { Router } from 'express';
import * as meterReadingController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/tenantGuard';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt);

// /sheet phải đăng ký TRƯỚC /:id để không bị nuốt bởi route tham số.
router.get('/sheet', requireRole(UserRole.LANDLORD), meterReadingController.sheet);

// GET: Landlord và Renter (Renter chỉ thấy phòng thuộc hợp đồng của mình nhờ RLS).
router.get('/', requireRole(UserRole.LANDLORD, UserRole.RENTER), meterReadingController.list);
router.get('/:id', requireRole(UserRole.LANDLORD, UserRole.RENTER), meterReadingController.getById);

// Ghi/sửa chỉ số: chỉ Landlord. Chỉ route TẠO MỚI yêu cầu gói còn hiệu lực.
router.post(
  '/',
  requireRole(UserRole.LANDLORD),
  requireActiveSubscription,
  meterReadingController.create
);
router.patch('/:id', requireRole(UserRole.LANDLORD), meterReadingController.update);

export default router;
