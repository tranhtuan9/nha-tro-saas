import { z } from 'zod';
import { SupportStatus, SupportType } from '@prisma/client';

export const createSupportRequestSchema = z.object({
  type: z.nativeEnum(SupportType, {
    errorMap: () => ({ message: 'Loại phản ánh không hợp lệ' }),
  }),
  title: z
    .string()
    .trim()
    .min(1, 'Tiêu đề không được để trống')
    .max(150, 'Tiêu đề tối đa 150 ký tự'),
  content: z
    .string()
    .trim()
    .min(1, 'Nội dung không được để trống')
    .max(4000, 'Nội dung tối đa 4000 ký tự'),
});

export const respondSupportRequestSchema = z.object({
  status: z.nativeEnum(SupportStatus, {
    errorMap: () => ({ message: 'Trạng thái không hợp lệ' }),
  }).refine((value) => value !== SupportStatus.OPEN, {
    message: 'Trạng thái phản hồi chỉ có thể là IN_PROGRESS hoặc RESOLVED',
  }),
  response: z
    .string()
    .trim()
    .min(1, 'Nội dung phản hồi không được để trống')
    .max(4000, 'Nội dung phản hồi tối đa 4000 ký tự')
    .optional(),
});

export const supportRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(SupportStatus).optional(),
  type: z.nativeEnum(SupportType).optional(),
  renterId: z.string().uuid('ID người thuê không hợp lệ').optional(),
});

export const supportRequestIdParamSchema = z.object({
  id: z.string().uuid('ID phản ánh không hợp lệ'),
});

export type CreateSupportRequestInput = z.infer<typeof createSupportRequestSchema>;
export type RespondSupportRequestInput = z.infer<typeof respondSupportRequestSchema>;
export type SupportRequestListQuery = z.infer<typeof supportRequestListQuerySchema>;
export type SupportRequestIdParam = z.infer<typeof supportRequestIdParamSchema>;
