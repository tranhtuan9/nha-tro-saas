import { Router } from 'express';
import * as invoiceController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';
import { requireActiveSubscription } from '../../middleware/tenantGuard';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateJwt);

// /preview và /summary phải đăng ký TRƯỚC /:id để không bị nuốt bởi route tham số.
router.post('/preview', requireRole(UserRole.LANDLORD), invoiceController.preview);
router.get('/summary', requireRole(UserRole.LANDLORD), invoiceController.summary);

// GET: Landlord và Renter (Renter chỉ thấy hóa đơn của mình nhờ RLS — UC30).
router.get('/', requireRole(UserRole.LANDLORD, UserRole.RENTER), invoiceController.list);
router.get('/:id', requireRole(UserRole.LANDLORD, UserRole.RENTER), invoiceController.getById);

// Chỉ TẠO MỚI yêu cầu gói còn hiệu lực; hủy không phải tạo mới (G7).
router.post(
  '/',
  requireRole(UserRole.LANDLORD),
  requireActiveSubscription,
  invoiceController.create
);
router.patch('/:id/cancel', requireRole(UserRole.LANDLORD), invoiceController.cancel);

export default router;
