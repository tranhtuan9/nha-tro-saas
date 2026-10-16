import { z } from 'zod';

export const renterIdParamSchema = z.object({
  id: z.string().uuid('ID người thuê không hợp lệ'),
});

export const renterListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'LOCKED']).optional(),
});

const phoneField = z
  .union([z.string().trim().max(20, 'Số điện thoại không hợp lệ'), z.literal(''), z.null()])
  .optional();

const nationalIdField = z
  .union([z.string().trim().max(20, 'Số CCCD không hợp lệ'), z.literal(''), z.null()])
  .optional();

export const createRenterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng').max(255),
  fullName: z.string().trim().min(2, 'Họ và tên phải từ 2 ký tự trở lên').max(150),
  phone: phoneField,
  nationalId: nationalIdField,
});

export const updateRenterSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Họ và tên phải từ 2 ký tự trở lên').max(150).optional(),
    phone: phoneField,
    nationalId: nationalIdField,
  })
  .refine(
    (data) =>
      data.fullName !== undefined || data.phone !== undefined || data.nationalId !== undefined,
    { message: 'Cần cung cấp ít nhất một trường để cập nhật' }
  );

export type RenterIdParam = z.infer<typeof renterIdParamSchema>;
export type RenterListQuery = z.infer<typeof renterListQuerySchema>;
export type CreateRenterInput = z.infer<typeof createRenterSchema>;
export type UpdateRenterInput = z.infer<typeof updateRenterSchema>;
