import { Request, Response } from 'express';
import * as authService from './service';
import {
  registerLandlordSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './schema';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const validated = registerLandlordSchema.parse(req.body);
    const result = await authService.registerLandlord(validated);
    res.status(201).json({
      message: 'Đăng ký tài khoản chủ trọ thành công',
      data: result,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: error.errors });
      return;
    }
    res.status(400).json({ message: error.message || 'Lỗi khi đăng ký tài khoản' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.login(validated);
    res.status(200).json({
      message: 'Đăng nhập thành công',
      data: result,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: error.errors });
      return;
    }
    // Lỗi sai mật khẩu, tài khoản bị khóa, hoặc tenant tạm ngưng
    res.status(401).json({ message: error.message || 'Lỗi khi đăng nhập' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const validated = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(validated);
    res.status(200).json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Email không hợp lệ', errors: error.errors });
      return;
    }
    res.status(500).json({ message: error.message || 'Lỗi khi xử lý yêu cầu' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const validated = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(validated);
    res.status(200).json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: error.errors });
      return;
    }
    res.status(400).json({ message: error.message || 'Lỗi khi đặt lại mật khẩu' });
  }
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Yêu cầu đăng nhập' });
      return;
    }
    const profile = await authService.getProfile(
      req.user.userId,
      req.user.role,
      req.user.tenantId
    );
    res.status(200).json({ data: profile });
  } catch (error: any) {
    res.status(404).json({ message: error.message || 'Không tìm thấy thông tin hồ sơ' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Yêu cầu đăng nhập' });
      return;
    }
    const validated = updateProfileSchema.parse(req.body);
    const updated = await authService.updateProfile(
      req.user.userId,
      req.user.role,
      req.user.tenantId,
      validated
    );
    res.status(200).json({ message: 'Cập nhật hồ sơ thành công', data: updated });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: error.errors });
      return;
    }
    res.status(400).json({ message: error.message || 'Lỗi khi cập nhật hồ sơ' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Yêu cầu đăng nhập' });
      return;
    }
    const validated = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(
      req.user.userId,
      req.user.role,
      req.user.tenantId,
      validated
    );
    res.status(200).json(result);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: error.errors });
      return;
    }
    res.status(400).json({ message: error.message || 'Lỗi khi đổi mật khẩu' });
  }
}
