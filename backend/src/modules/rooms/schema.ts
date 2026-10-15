import { z } from 'zod';

export const roomIdParamSchema = z.object({
  id: z.string().uuid('ID phòng không hợp lệ'),
});

export const roomListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  propertyId: z.string().uuid('ID nhà trọ không hợp lệ').optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE']).optional(),
  search: z.string().trim().optional(),
});

export const createRoomSchema = z.object({
  propertyId: z.string().uuid('ID nhà trọ không hợp lệ'),
  roomCode: z.string().trim().min(1, 'Mã phòng không được để trống').max(30),
  areaM2: z.number().min(0, 'Diện tích không được âm').optional(),
  basePrice: z.number().min(0, 'Giá thuê không được âm'),
  description: z.string().trim().max(2000).optional(),
});

export const updateRoomSchema = z
  .object({
    propertyId: z.string().uuid('ID nhà trọ không hợp lệ').optional(),
    roomCode: z.string().trim().min(1, 'Mã phòng không được để trống').max(30).optional(),
    areaM2: z.number().min(0, 'Diện tích không được âm').optional(),
    basePrice: z.number().min(0, 'Giá thuê không được âm').optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Cần cung cấp ít nhất một trường để cập nhật',
  });

// Không cho set OCCUPIED thủ công (chỉ AVAILABLE hoặc MAINTENANCE).
export const updateRoomStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'MAINTENANCE'], {
    errorMap: () => ({ message: 'Chỉ được đặt trạng thái AVAILABLE hoặc MAINTENANCE' }),
  }),
});

export type RoomIdParam = z.infer<typeof roomIdParamSchema>;
export type RoomListQuery = z.infer<typeof roomListQuerySchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type UpdateRoomStatusInput = z.infer<typeof updateRoomStatusSchema>;
