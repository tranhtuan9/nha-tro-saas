import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('ID không hợp lệ'),
});

export const tenantIdParamSchema = z.object({
  id: z.string().uuid('ID không hợp lệ'),
});

export const planIdParamSchema = z.object({
  id: z.string().uuid('ID không hợp lệ'),
});

export const updatePlanSchema = z.object({
  name: z.string().trim().min(2, 'Tên gói phải từ 2 ký tự trở lên').max(100).optional(),
  maxProperties: z.number().int().min(0).optional(),
  maxRooms: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  durationDays: z.number().int().min(1).optional(),
});

export const changeTenantPlanSchema = z.object({
  planId: z.string().uuid('ID gói không hợp lệ'),
  extendDays: z.number().int().min(1).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type TenantIdParam = z.infer<typeof tenantIdParamSchema>;
export type PlanIdParam = z.infer<typeof planIdParamSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type ChangeTenantPlanInput = z.infer<typeof changeTenantPlanSchema>;
