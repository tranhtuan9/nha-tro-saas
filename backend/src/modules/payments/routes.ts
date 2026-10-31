import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { UserRole } from '@prisma/client';
import * as paymentController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';

const router = Router();

// Rate limit tạo link: 30 request / 5 phút / người dùng (D5).
const createLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.userId ?? 'anonymous',
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Bạn đã gửi quá nhiều yêu cầu thanh toán. Vui lòng thử lại sau 5 phút.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticateJwt);

// Chỉ RENTER tạo/hủy/sync link thanh toán của chính mình (RLS); LANDLORD xem lịch sử (UC32).
router.post('/', requireRole(UserRole.RENTER), createLimiter, paymentController.create);
router.post('/:id/cancel', requireRole(UserRole.RENTER), paymentController.cancel);
router.post('/:id/sync', requireRole(UserRole.RENTER), paymentController.sync);
router.get('/', requireRole(UserRole.LANDLORD, UserRole.RENTER), paymentController.list);
router.get('/:id', requireRole(UserRole.LANDLORD, UserRole.RENTER), paymentController.getById);

export default router;
