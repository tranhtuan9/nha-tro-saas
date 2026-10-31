import { Prisma } from '@prisma/client';
import { getTenantDb, type TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import type { NotificationListQuery } from './schema';

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  content: true,
  entityId: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

function serializeNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    entityId: row.entityId,
    isRead: row.isRead,
    createdAt: row.createdAt,
  };
}

/**
 * userId CHỈ lấy từ JWT đã xác thực; KHÔNG nhận từ query/body.
 * Renter và Landlord đều xem thông báo CỦA CHÍNH MÌNH (thêm điều kiện userId),
 * dù RLS chỉ chặn theo tenant.
 */
function requireUserId(context: TenantContext): string {
  if (!context.userId) {
    throw ApiError.forbidden('NO_USER', 'Tài khoản không hợp lệ');
  }
  return context.userId;
}

export async function listNotifications(context: TenantContext, query: NotificationListQuery) {
  const db = getTenantDb(context);
  const userId = requireUserId(context);

  const where: Prisma.NotificationWhereInput = { userId };
  if (query.isRead !== undefined) where.isRead = query.isRead;

  const total = await db.notification.count({ where });
  const rows = await db.notification.findMany({
    where,
    select: notificationSelect,
    orderBy: [{ createdAt: 'desc' }],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  // unreadCount luôn tính trên TOÀN BỘ thông báo chưa đọc của chính người gọi,
  // không phụ thuộc bộ lọc isRead đang áp dụng (phục vụ badge chuông thông báo).
  const unreadCount = await db.notification.count({ where: { userId, isRead: false } });

  return {
    data: rows.map(serializeNotification),
    pagination: { page: query.page, pageSize: query.pageSize, total },
    unreadCount,
  };
}

export async function countUnread(context: TenantContext) {
  const db = getTenantDb(context);
  const userId = requireUserId(context);
  const count = await db.notification.count({ where: { userId, isRead: false } });
  return { count };
}

export async function markRead(context: TenantContext, notificationId: string) {
  const db = getTenantDb(context);
  const userId = requireUserId(context);

  const existing = await db.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true },
  });
  if (!existing || existing.userId !== userId) {
    throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo');
  }

  const updated = await db.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
    select: notificationSelect,
  });
  return serializeNotification(updated);
}

export async function markAllRead(context: TenantContext) {
  const db = getTenantDb(context);
  const userId = requireUserId(context);
  const result = await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { count: result.count };
}
