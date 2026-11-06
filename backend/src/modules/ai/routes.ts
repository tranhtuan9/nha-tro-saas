import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { UserRole } from '@prisma/client';
import * as aiController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';

const router = Router();

// Rate limit chat theo từng người dùng: 20 request / 5 phút.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.userId ?? 'anonymous',
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Bạn đã gửi quá nhiều yêu cầu cho trợ lý AI. Vui lòng thử lại sau 5 phút.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticateJwt);

router.post('/chat', requireRole(UserRole.LANDLORD), chatLimiter, aiController.chat);

// Xác nhận/từ chối KHÔNG dùng requireActiveSubscription: service tự kiểm hạn gói theo loại hành động.
router.get('/proposals', requireRole(UserRole.LANDLORD), aiController.listProposals);
router.post('/proposals/:id/confirm', requireRole(UserRole.LANDLORD), aiController.confirmProposal);
router.post('/proposals/:id/reject', requireRole(UserRole.LANDLORD), aiController.rejectProposal);

export default router;
