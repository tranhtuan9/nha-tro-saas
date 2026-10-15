import { Request, Response } from 'express';
import * as adminService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  paginationQuerySchema,
  tenantListQuerySchema,
  userIdParamSchema,
  tenantIdParamSchema,
  planIdParamSchema,
  updatePlanSchema,
  createPlanSchema,
  changeTenantPlanSchema,
} from './schema';

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = paginationQuerySchema.parse(req.query);
  const result = await adminService.listUsers(query);
  res.status(200).json({ data: result });
});

export const lockUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = userIdParamSchema.parse(req.params);
  const user = await adminService.lockUser(id, req.user!.userId);
  res.status(200).json({ message: 'Khóa tài khoản thành công', data: user });
});

export const unlockUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = userIdParamSchema.parse(req.params);
  const user = await adminService.unlockUser(id);
  res.status(200).json({ message: 'Mở khóa tài khoản thành công', data: user });
});

export const getTenants = asyncHandler(async (req: Request, res: Response) => {
  const query = tenantListQuerySchema.parse(req.query);
  const result = await adminService.listTenants(query);
  res.status(200).json({ data: result });
});

export const getTenant = asyncHandler(async (req: Request, res: Response) => {
  const { id } = tenantIdParamSchema.parse(req.params);
  const tenant = await adminService.getTenant(id);
  res.status(200).json({ data: tenant });
});

export const suspendTenant = asyncHandler(async (req: Request, res: Response) => {
  const { id } = tenantIdParamSchema.parse(req.params);
  const tenant = await adminService.suspendTenant(id);
  res.status(200).json({ message: 'Tạm ngưng Tenant thành công', data: tenant });
});

export const activateTenant = asyncHandler(async (req: Request, res: Response) => {
  const { id } = tenantIdParamSchema.parse(req.params);
  const tenant = await adminService.activateTenant(id);
  res.status(200).json({ message: 'Kích hoạt Tenant thành công', data: tenant });
});

export const getPlans = asyncHandler(async (req: Request, res: Response) => {
  const plans = await adminService.listPlans();
  res.status(200).json({ data: plans });
});

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const input = createPlanSchema.parse(req.body);
  const plan = await adminService.createPlan(input);
  res.status(201).json({ message: 'Tạo gói thành công', data: plan });
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = planIdParamSchema.parse(req.params);
  const input = updatePlanSchema.parse(req.body);
  const plan = await adminService.updatePlan(id, input);
  res.status(200).json({ message: 'Cập nhật gói thành công', data: plan });
});

export const deactivatePlan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = planIdParamSchema.parse(req.params);
  const plan = await adminService.deactivatePlan(id);
  res.status(200).json({ message: 'Ẩn gói thành công', data: plan });
});

export const changeTenantPlan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = tenantIdParamSchema.parse(req.params);
  const input = changeTenantPlanSchema.parse(req.body);
  const result = await adminService.changeTenantPlan(id, input);
  res.status(200).json({
    message: 'Đổi gói và gia hạn thành công',
    data: result.tenant,
    warnings: result.warnings,
  });
});
