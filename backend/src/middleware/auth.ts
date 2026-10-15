import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt';
import { prismaSystem } from '../lib/db';
import { ApiError } from '../lib/ApiError';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';

// Mở rộng kiểu Request của Express để chứa thông tin user đã xác thực
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware xác thực JWT và kiểm tra trạng thái thời gian thực của User và Tenant
 */
export async function authenticateJwt(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(ApiError.unauthorized('UNAUTHORIZED', 'Thiếu hoặc sai định dạng token xác thực'));
    return;
  }

  const token = authHeader.substring(7);

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    next(ApiError.unauthorized('INVALID_TOKEN', 'Token không hợp lệ hoặc đã hết hạn'));
    return;
  }

  try {
    // Kiểm tra trạng thái thời gian thực từ database qua prismaSystem (BYPASSRLS)
    const user = await prismaSystem.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, status: true, role: true, tenantId: true },
    });

    if (!user || user.status === UserStatus.LOCKED) {
      next(ApiError.forbidden('ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa hoặc không tồn tại'));
      return;
    }

    // Nếu không phải Admin, kiểm tra thêm trạng thái Tenant
    if (user.role !== UserRole.ADMIN && user.tenantId) {
      const tenant = await prismaSystem.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, status: true },
      });

      if (!tenant || tenant.status === TenantStatus.SUSPENDED) {
        next(
          ApiError.forbidden(
            'TENANT_SUSPENDED',
            'Gói dịch vụ hoặc Tenant của bạn đang bị tạm ngưng'
          )
        );
        return;
      }
    }

    req.user = payload;
    next();
  } catch (error) {
    next(ApiError.internal('INTERNAL_ERROR', 'Lỗi xác thực hệ thống'));
  }
}

/**
 * Middleware phân quyền theo vai trò (RBAC)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized('UNAUTHORIZED', 'Yêu cầu đăng nhập'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(ApiError.forbidden('FORBIDDEN', 'Bạn không có quyền thực hiện chức năng này'));
      return;
    }

    next();
  };
}
