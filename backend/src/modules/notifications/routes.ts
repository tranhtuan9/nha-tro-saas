import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as notificationController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticateJwt);

// Landlord và Renter đều xem/dọn thông báo CỦA MÌNH (service lọc thêm theo userId từ JWT).
const roles = requireRole(UserRole.LANDLORD, UserRole.RENTER);

router.get('/', roles, notificationController.list);
router.get('/unread-count', roles, notificationController.unreadCount);
router.patch('/read-all', roles, notificationController.markAllRead);
router.patch('/:id/read', roles, notificationController.markRead);

export default router;
