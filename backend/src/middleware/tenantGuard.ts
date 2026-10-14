import { Request, Response, NextFunction } from 'express';
import { prismaSystem } from '../lib/db';
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
    res.status(401).json({ message: 'Yêu cầu đăng nhập' });
    return;
  }

  // Admin không bị giới hạn bởi Tenant
  if (req.user.role === UserRole.ADMIN) {
    next();
    return;
  }

  if (!req.user.tenantId) {
    res.status(403).json({ message: 'Tài khoản không thuộc Tenant hợp lệ' });
    return;
  }

  try {
    const tenant = await prismaSystem.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { subscriptionEnd: true },
    });

    if (!tenant) {
      res.status(404).json({ message: 'Không tìm thấy thông tin Tenant' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const subscriptionEnd = new Date(tenant.subscriptionEnd);
    subscriptionEnd.setHours(23, 59, 59, 999);

    if (today > subscriptionEnd) {
      res.status(403).json({
        message: 'Gói dịch vụ đã hết hạn. Bạn chỉ có quyền xem dữ liệu, không thể tạo mới.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Lỗi kiểm tra hạn dịch vụ' });
    return;
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
      res.status(403).json({ message: 'Thiếu tenantId' });
      return;
    }

    try {
      const tenant = await prismaSystem.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true },
      });

      if (!tenant || !tenant.plan) {
        res.status(404).json({ message: 'Không tìm thấy gói dịch vụ của Tenant' });
        return;
      }

      if (resourceType === 'property') {
        const currentCount = await prismaSystem.property.count({
          where: { tenantId, isActive: true },
        });

        if (currentCount >= tenant.plan.maxProperties) {
          res.status(403).json({
            message: `Bạn đã đạt giới hạn tối đa số nhà trọ (${tenant.plan.maxProperties}) của gói ${tenant.plan.name}. Vui lòng nâng cấp gói để tạo thêm.`,
            code: 'PLAN_LIMIT_REACHED',
          });
          return;
        }
      } else if (resourceType === 'room') {
        const currentCount = await prismaSystem.room.count({
          where: { tenantId },
        });

        if (currentCount >= tenant.plan.maxRooms) {
          res.status(403).json({
            message: `Bạn đã đạt giới hạn tối đa số phòng (${tenant.plan.maxRooms}) của gói ${tenant.plan.name}. Vui lòng nâng cấp gói để tạo thêm.`,
            code: 'PLAN_LIMIT_REACHED',
          });
          return;
        }
      }

      next();
    } catch (error) {
      res.status(500).json({ message: 'Lỗi kiểm tra giới hạn gói' });
      return;
    }
  };
}
