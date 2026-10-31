import { z } from 'zod';

// Kỳ nhận định dạng YYYY-MM; lưu thành ngày đầu tháng.
export const billingMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ phải có định dạng YYYY-MM');

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Ngày phải có định dạng YYYY-MM-DD');

export const invoiceIdParamSchema = z.object({
  id: z.string().uuid('ID hóa đơn không hợp lệ'),
});

// quantity vừa cột decimal(8,2): max 999999.99 — chặn tràn trước khi chạm DB.
export const invoiceServiceItemSchema = z.object({
  serviceId: z.string().uuid('ID dịch vụ không hợp lệ'),
  quantity: z
    .number()
    .positive('Số lượng phải lớn hơn 0')
    .max(999999.99, 'Số lượng vượt quá giới hạn'),
});

export const createInvoiceSchema = z.object({
  contractId: z.string().uuid('ID hợp đồng không hợp lệ'),
  billingMonth: billingMonthSchema,
  services: z
    .array(invoiceServiceItemSchema)
    .default([])
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      for (const item of items) {
        if (seen.has(item.serviceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Trùng serviceId trong danh sách dịch vụ',
            path: ['services'],
          });
          return;
        }
        seen.add(item.serviceId);
      }
    }),
  dueDate: dateOnlySchema.optional(),
});

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['UNPAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  billingMonth: billingMonthSchema.optional(),
  roomId: z.string().uuid('ID phòng không hợp lệ').optional(),
  propertyId: z.string().uuid('ID nhà trọ không hợp lệ').optional(),
  contractId: z.string().uuid('ID hợp đồng không hợp lệ').optional(),
});

export const summaryQuerySchema = z.object({
  month: billingMonthSchema.optional(),
});

export type InvoiceIdParam = z.infer<typeof invoiceIdParamSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
