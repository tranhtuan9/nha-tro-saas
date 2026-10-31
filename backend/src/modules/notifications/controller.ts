import { Request, Response } from 'express';
import * as notificationService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import { notificationIdParamSchema, notificationListQuerySchema } from './schema';

// tenantId/userId/role CHỈ lấy từ JWT đã xác thực (req.user), không lấy từ body/query/params.
function getContext(req: Request): TenantContext {
  const user = req.user;
  if (!user || !user.tenantId) {
    throw ApiError.forbidden('NO_TENANT', 'Tài khoản không thuộc Tenant hợp lệ');
  }
  return { tenantId: user.tenantId, userId: user.userId, role: user.role };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const query = notificationListQuerySchema.parse(req.query);
  const result = await notificationService.listNotifications(context, query);
  res.status(200).json(result);
});

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const result = await notificationService.countUnread(context);
  res.status(200).json({ data: result });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = notificationIdParamSchema.parse(req.params);
  const notification = await notificationService.markRead(context, id);
  res.status(200).json({ message: 'Đã đánh dấu thông báo đã đọc', data: notification });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const result = await notificationService.markAllRead(context);
  res.status(200).json({ message: 'Đã đánh dấu tất cả thông báo đã đọc', data: result });
});
