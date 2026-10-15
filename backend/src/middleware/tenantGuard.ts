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
  } catch (error) {
    next(ApiError.internal('INTERNAL_ERROR', 'Lỗi kiểm tra hạn dịch vụ'));
  }
}

/**
 * Middleware kiểm tra giới hạn gói dịch vụ (max_properties, max_rooms)
 */
export function checkResourceLimit(resourceType: 'property' | 'room') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    const tenantId = req.user.tenantId;
    if (!tenantId) {
      next(ApiError.forbidden('NO_TENANT', 'Thiếu tenantId'));
      return;
    }

    try {
      const tenant = await prismaSystem.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true },
      });

      if (!tenant || !tenant.plan) {
        next(
          ApiError.notFound('PLAN_NOT_FOUND', 'Không tìm thấy gói dịch vụ của Tenant')
        );
        return;
      }

      if (resourceType === 'property') {
        const currentCount = await prismaSystem.property.count({
          where: { tenantId, isActive: true },
        });

        if (currentCount >= tenant.plan.maxProperties) {
          next(
            ApiError.forbidden(
              'PLAN_LIMIT_REACHED',
              `Bạn đã đạt giới hạn tối đa số nhà trọ (${tenant.plan.maxProperties}) của gói ${tenant.plan.name}. Vui lòng nâng cấp gói để tạo thêm.`
            )
          );
          return;
        }
      } else if (resourceType === 'room') {
        const currentCount = await prismaSystem.room.count({
          where: { tenantId },
        });

        if (currentCount >= tenant.plan.maxRooms) {
          next(
            ApiError.forbidden(
              'PLAN_LIMIT_REACHED',
              `Bạn đã đạt giới hạn tối đa số phòng (${tenant.plan.maxRooms}) của gói ${tenant.plan.name}. Vui lòng nâng cấp gói để tạo thêm.`
            )
          );
          return;
        }
      }

      next();
    } catch (error) {
      next(ApiError.internal('INTERNAL_ERROR', 'Lỗi kiểm tra giới hạn gói'));
    }
  };
}
