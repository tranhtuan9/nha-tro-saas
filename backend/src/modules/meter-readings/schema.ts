import { z } from 'zod';

// Kỳ nhận định dạng YYYY-MM; lưu thành ngày đầu tháng.
export const billingMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ phải có định dạng YYYY-MM');

export const meterReadingIdParamSchema = z.object({
  id: z.string().uuid('ID chỉ số không hợp lệ'),
});

export const meterReadingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  roomId: z.string().uuid('ID phòng không hợp lệ').optional(),
  propertyId: z.string().uuid('ID nhà trọ không hợp lệ').optional(),
  billingMonth: billingMonthSchema.optional(),
});

export const meterSheetQuerySchema = z.object({
  propertyId: z.string().uuid('ID nhà trọ không hợp lệ'),
  billingMonth: billingMonthSchema,
});

const indexValue = z.number().min(0, 'Chỉ số không được âm');

export const createMeterReadingSchema = z.object({
  roomId: z.string().uuid('ID phòng không hợp lệ'),
  billingMonth: billingMonthSchema,
  electricityIndex: indexValue,
  waterIndex: indexValue,
  confirmAnomaly: z.boolean().optional().default(false),
  // Mốc chỉ khi phòng CHƯA có kỳ nào (dùng cho kỳ khởi tạo).
  previousElectricityIndex: indexValue.optional(),
  previousWaterIndex: indexValue.optional(),
});

export const updateMeterReadingSchema = z
  .object({
    electricityIndex: indexValue.optional(),
    waterIndex: indexValue.optional(),
    confirmAnomaly: z.boolean().optional().default(false),
  })
  .strict('Không được gửi trường không hợp lệ khi sửa chỉ số')
  .refine(
    (data) => data.electricityIndex !== undefined || data.waterIndex !== undefined,
    { message: 'Cần cung cấp ít nhất chỉ số điện hoặc nước để cập nhật' }
  );

export type MeterReadingIdParam = z.infer<typeof meterReadingIdParamSchema>;
export type MeterReadingListQuery = z.infer<typeof meterReadingListQuerySchema>;
export type MeterSheetQuery = z.infer<typeof meterSheetQuerySchema>;
export type CreateMeterReadingInput = z.infer<typeof createMeterReadingSchema>;
export type UpdateMeterReadingInput = z.infer<typeof updateMeterReadingSchema>;
