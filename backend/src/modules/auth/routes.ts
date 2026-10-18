import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from './controller';
import { authenticateJwt } from '../../middleware/auth';

const router = Router();

// Rate limiter chống Brute Force đăng nhập (tối đa 10 request / 15 phút)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // cho phép tối đa 10 request login trong 15 phút
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter cho gửi yêu cầu quên mật khẩu (tối đa 5 lần / 1 giờ)
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Bạn đã yêu cầu gửi email quá nhiều lần. Vui lòng thử lại sau 1 giờ.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Public Endpoints ---
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// --- Protected Endpoints (Yêu cầu JWT) ---
router.get('/me', authenticateJwt, authController.getProfile);
router.put('/me', authenticateJwt, authController.updateProfile);
router.post('/change-password', authenticateJwt, authController.changePassword);

export default router;
