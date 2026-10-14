import { Request, Response } from 'express';
import * as adminService from './service';
import {
  paginationQuerySchema,
  userIdParamSchema,
  tenantIdParamSchema,
  planIdParamSchema,
  updatePlanSchema,
  changeTenantPlanSchema,
} from './schema';

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const query = paginationQuerySchema.parse(req.query);
    const result = await adminService.listUsers(query);
    res.status(200).json({ data: result });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Tham số phân trang không hợp lệ', errors: error.errors });
      return;
    }
    res.status(400).json({ message: error.message || 'Lỗi khi lấy danh sách người dùng' });
  }
}

export async function lockUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await adminService.lockUser(id);
    res.status(200).json({ message: 'Khóa tài khoản thành công', data: user });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'ID người dùng không hợp lệ', errors: error.errors });
      return;
    }
    const status = error.message?.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ message: error.message || 'Lỗi khi khóa tài khoản' });
  }
}

export async function unlockUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await adminService.unlockUser(id);
    res.status(200).json({ message: 'Mở khóa tài khoản thành công', data: user });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'ID người dùng không hợp lệ', errors: error.errors });
      return;
    }
    const status = error.message?.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ message: error.message || 'Lỗi khi mở khóa tài khoản' });
  }
}

export async function getTenants(req: Request, res: Response): Promise<void> {
  try {
    const query = paginationQuerySchema.parse(req.query);
    const result = await adminService.listTenants(query);
    res.status(200).json({ data: result });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Tham số phân trang không hợp lệ', errors: error.errors });
      return;
    }
    res.status(400).json({ message: error.message || 'Lỗi khi lấy danh sách Tenant' });
  }
}

export async function suspendTenant(req: Request, res: Response): Promise<void> {
  try {
    const { id } = tenantIdParamSchema.parse(req.params);
    const tenant = await adminService.suspendTenant(id);
    res.status(200).json({ message: 'Tạm ngưng Tenant thành công', data: tenant });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'ID Tenant không hợp lệ', errors: error.errors });
      return;
    }
    const status = error.message?.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ message: error.message || 'Lỗi khi tạm ngưng Tenant' });
  }
}

export async function activateTenant(req: Request, res: Response): Promise<void> {
  try {
    const { id } = tenantIdParamSchema.parse(req.params);
    const tenant = await adminService.activateTenant(id);
    res.status(200).json({ message: 'Kích hoạt Tenant thành công', data: tenant });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'ID Tenant không hợp lệ', errors: error.errors });
      return;
    }
    const status = error.message?.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ message: error.message || 'Lỗi khi kích hoạt Tenant' });
  }
}

export async function getPlans(req: Request, res: Response): Promise<void> {
  try {
    const plans = await adminService.listPlans();
    res.status(200).json({ data: plans });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Lỗi khi lấy danh sách gói' });
  }
}

export async function updatePlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = planIdParamSchema.parse(req.params);
    const input = updatePlanSchema.parse(req.body);
    const plan = await adminService.updatePlan(id, input);
    res.status(200).json({ message: 'Cập nhật gói thành công', data: plan });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Dữ liệu cập nhật gói không hợp lệ', errors: error.errors });
      return;
    }
    const status = error.message?.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ message: error.message || 'Lỗi khi cập nhật gói' });
  }
}

export async function deactivatePlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = planIdParamSchema.parse(req.params);
    const plan = await adminService.deactivatePlan(id);
    res.status(200).json({ message: 'Ẩn gói thành công', data: plan });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'ID gói không hợp lệ', errors: error.errors });
      return;
    }
    const status = error.message?.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ message: error.message || 'Lỗi khi ẩn gói' });
  }
}

export async function changeTenantPlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = tenantIdParamSchema.parse(req.params);
    const input = changeTenantPlanSchema.parse(req.body);
    const tenant = await adminService.changeTenantPlan(id, input);
    res.status(200).json({ message: 'Đổi gói và gia hạn thành công', data: tenant });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Dữ liệu đổi gói không hợp lệ', errors: error.errors });
      return;
    }
    const status = error.message?.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ message: error.message || 'Lỗi khi đổi gói' });
  }
}
