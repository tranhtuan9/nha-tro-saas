import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('ID thông báo không hợp lệ'),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
