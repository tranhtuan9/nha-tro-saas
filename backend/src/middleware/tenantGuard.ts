import { Request, Response, NextFunction } from 'express';
import { prismaSystem } from '../lib/db';
import { ApiError } from '../lib/ApiError';
import { UserRole } from '@prisma/client';

/**
 * Middleware chặn tạo mới dữ liệu khi Tenant hết hạn gói dịch vụ (Luật 12)
 */
export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    next(ApiError.unauthorized('UNAUTHORIZED', 'Yêu cầu đăng nhập'));
    return;
  }

  // Admin không bị giới hạn bởi Tenant
  if (req.user.role === UserRole.ADMIN) {
    next();
    return;
  }

  if (!req.user.tenantId) {
    next(ApiError.forbidden('NO_TENANT', 'Tài khoản không thuộc Tenant hợp lệ'));
    return;
  }

  try {
    const tenant = await prismaSystem.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { subscriptionEnd: true },
    });

    if (!tenant) {
      next(ApiError.notFound('TENANT_NOT_FOUND', 'Không tìm thấy thông tin Tenant'));
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const subscriptionEnd = new Date(tenant.subscriptionEnd);
    subscriptionEnd.setHours(23, 59, 59, 999);

    if (today > subscriptionEnd) {
      next(
        ApiError.forbidden(
          'SUBSCRIPTION_EXPIRED',
          'Gói dịch vụ đã hết hạn. Bạn chỉ có quyền xem dữ liệu, không thể tạo mới.'
        )
      );
      return;
    }

    next();
  } catch {
    next(ApiError.internal('INTERNAL_ERROR', 'Lỗi kiểm tra hạn dịch vụ'));
  }
}
