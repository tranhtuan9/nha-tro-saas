import { z } from 'zod';

// Chỉ nhận invoiceId (strict); tenantId/userId/role luôn từ JWT, không nhận từ body.
export const createPaymentSchema = z
  .object({
    invoiceId: z.string().uuid('ID hóa đơn không hợp lệ'),
  })
  .strict();

export const paymentIdParamSchema = z.object({
  id: z.string().uuid('ID thanh toán không hợp lệ'),
});

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  invoiceId: z.string().uuid('ID hóa đơn không hợp lệ').optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'FAILED']).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentIdParam = z.infer<typeof paymentIdParamSchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
