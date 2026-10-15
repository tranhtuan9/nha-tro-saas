import { Request, Response } from 'express';
import * as authService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import {
  registerLandlordSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './schema';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const validated = registerLandlordSchema.parse(req.body);
  const result = await authService.registerLandlord(validated);
  res.status(201).json({
    message: 'Đăng ký tài khoản chủ trọ thành công',
    data: result,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const validated = loginSchema.parse(req.body);
  const result = await authService.login(validated);
  res.status(200).json({
    message: 'Đăng nhập thành công',
    data: result,
  });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const validated = forgotPasswordSchema.parse(req.body);
  const result = await authService.forgotPassword(validated);
  res.status(200).json(result);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const validated = resetPasswordSchema.parse(req.body);
  const result = await authService.resetPassword(validated);
  res.status(200).json(result);
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('UNAUTHORIZED', 'Yêu cầu đăng nhập');
  }
  const profile = await authService.getProfile(req.user.userId, req.user.role, req.user.tenantId);
  res.status(200).json({ data: profile });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('UNAUTHORIZED', 'Yêu cầu đăng nhập');
  }
  const validated = updateProfileSchema.parse(req.body);
  const updated = await authService.updateProfile(
    req.user.userId,
    req.user.role,
    req.user.tenantId,
    validated
  );
  res.status(200).json({ message: 'Cập nhật hồ sơ thành công', data: updated });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('UNAUTHORIZED', 'Yêu cầu đăng nhập');
  }
  const validated = changePasswordSchema.parse(req.body);
  const result = await authService.changePassword(
    req.user.userId,
    req.user.role,
    req.user.tenantId,
    validated
  );
  res.status(200).json(result);
});
