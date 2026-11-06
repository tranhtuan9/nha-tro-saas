import { Router } from 'express';
import { UserRole } from '@prisma/client';
import * as supportRequestController from './controller';
import { authenticateJwt, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticateJwt);

// UC33: Renter gửi và xem phản ánh của mình.
router.post('/', requireRole(UserRole.RENTER), supportRequestController.create);

// UC20/UC33: Renter (của mình, RLS) và Landlord (cả Tenant) đều xem danh sách/chi tiết.
const viewer = requireRole(UserRole.LANDLORD, UserRole.RENTER);
router.get('/', viewer, supportRequestController.list);
router.get('/:id', viewer, supportRequestController.getById);

// UC20: chỉ Landlord phản hồi và đổi trạng thái.
router.patch('/:id/respond', requireRole(UserRole.LANDLORD), supportRequestController.respond);

export default router;
