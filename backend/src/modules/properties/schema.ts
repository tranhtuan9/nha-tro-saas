import { z } from 'zod';

export const propertyIdParamSchema = z.object({
  id: z.string().uuid('ID nhà trọ không hợp lệ'),
});

export const propertyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const createPropertySchema = z.object({
  name: z.string().trim().min(2, 'Tên nhà trọ phải từ 2 ký tự trở lên').max(150),
  address: z.string().trim().min(2, 'Địa chỉ phải từ 2 ký tự trở lên').max(255),
  description: z.string().trim().max(2000).optional(),
  electricityUnitPrice: z.number().min(0, 'Đơn giá điện không được âm'),
  waterUnitPrice: z.number().min(0, 'Đơn giá nước không được âm'),
});

export const updatePropertySchema = z
  .object({
    name: z.string().trim().min(2, 'Tên nhà trọ phải từ 2 ký tự trở lên').max(150).optional(),
    address: z.string().trim().min(2, 'Địa chỉ phải từ 2 ký tự trở lên').max(255).optional(),
    description: z.string().trim().max(2000).optional(),
    electricityUnitPrice: z.number().min(0, 'Đơn giá điện không được âm').optional(),
    waterUnitPrice: z.number().min(0, 'Đơn giá nước không được âm').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Cần cung cấp ít nhất một trường để cập nhật',
  });

export type PropertyIdParam = z.infer<typeof propertyIdParamSchema>;
export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
