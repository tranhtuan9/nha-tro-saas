import { z } from 'zod';

export const serviceIdParamSchema = z.object({
  id: z.string().uuid('ID dịch vụ không hợp lệ'),
});

export const serviceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  propertyId: z.string().uuid('ID nhà trọ không hợp lệ').optional(),
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const createServiceSchema = z.object({
  propertyId: z.string().uuid('ID nhà trọ không hợp lệ'),
  name: z.string().trim().min(1, 'Tên dịch vụ không được để trống').max(100),
  unit: z.string().trim().min(1, 'Đơn vị tính không được để trống').max(30),
  unitPrice: z.number().int('Đơn giá phải là số nguyên').min(0, 'Đơn giá không được âm'),
});

export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(1, 'Tên dịch vụ không được để trống').max(100).optional(),
    unit: z.string().trim().min(1, 'Đơn vị tính không được để trống').max(30).optional(),
    unitPrice: z
      .number()
      .int('Đơn giá phải là số nguyên')
      .min(0, 'Đơn giá không được âm')
      .optional(),
  })
  // KHÔNG cho đổi propertyId (và từ chối mọi trường lạ) — 400.
  .strict('Không được đổi nhà trọ của dịch vụ hoặc gửi trường không hợp lệ')
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Cần cung cấp ít nhất một trường để cập nhật',
  });

export type ServiceIdParam = z.infer<typeof serviceIdParamSchema>;
export type ServiceListQuery = z.infer<typeof serviceListQuerySchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
