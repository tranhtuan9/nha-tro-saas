import { z } from 'zod';

// Ngày kiểu ISO dạng YYYY-MM-DD (chỉ nhận ngày, không nhận giờ).
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có định dạng YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    );
  }, 'Ngày không hợp lệ');

export const contractIdParamSchema = z.object({
  id: z.string().uuid('ID hợp đồng không hợp lệ'),
});

export const contractListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  roomId: z.string().uuid('ID phòng không hợp lệ').optional(),
  renterId: z.string().uuid('ID người thuê không hợp lệ').optional(),
  propertyId: z.string().uuid('ID nhà trọ không hợp lệ').optional(),
  status: z.enum(['ACTIVE', 'ENDED', 'TERMINATED']).optional(),
});

export const createContractSchema = z.object({
  roomId: z.string().uuid('ID phòng không hợp lệ'),
  renterId: z.string().uuid('ID người thuê không hợp lệ'),
  startDate: isoDate,
  endDate: isoDate,
  monthlyRent: z.number().min(0, 'Tiền thuê không được âm'),
  deposit: z.number().min(0, 'Tiền cọc không được âm').default(0),
  terms: z.string().trim().max(5000).optional(),
});

export const updateContractSchema = z
  .object({
    endDate: isoDate.optional(),
    monthlyRent: z.number().min(0, 'Tiền thuê không được âm').optional(),
    deposit: z.number().min(0, 'Tiền cọc không được âm').optional(),
    terms: z.string().trim().max(5000).optional(),
  })
  .refine(
    (data) =>
      data.endDate !== undefined ||
      data.monthlyRent !== undefined ||
      data.deposit !== undefined ||
      data.terms !== undefined,
    { message: 'Cần cung cấp ít nhất một trường để cập nhật' }
  );

// PATCH /:id/terminate — reason lưu vào cột terminated_reason của hợp đồng.
export const terminateContractSchema = z.object({
  reason: z.string().trim().max(500, 'Lý do tối đa 500 ký tự').optional().or(z.literal('')),
});

export type ContractIdParam = z.infer<typeof contractIdParamSchema>;
export type ContractListQuery = z.infer<typeof contractListQuerySchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type TerminateContractInput = z.infer<typeof terminateContractSchema>;
