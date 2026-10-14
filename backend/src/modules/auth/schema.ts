import { z } from 'zod';

export const registerLandlordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
  fullName: z.string().trim().min(2, 'Họ và tên phải từ 2 ký tự trở lên'),
  phone: z.string().trim().min(9, 'Số điện thoại không hợp lệ').max(15).optional().or(z.literal('')),
  nationalId: z.string().trim().min(9, 'Số CCCD không hợp lệ').max(20).optional().or(z.literal('')),
  tenantName: z.string().trim().min(2, 'Tên hệ thống nhà trọ phải từ 2 ký tự trở lên'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token không được để trống'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải từ 6 ký tự trở lên'),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ và tên phải từ 2 ký tự trở lên').optional(),
  phone: z.string().trim().min(9, 'Số điện thoại không hợp lệ').max(15).optional().or(z.literal('')),
  nationalId: z.string().trim().min(9, 'Số CCCD không hợp lệ').max(20).optional().or(z.literal('')),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải từ 6 ký tự trở lên'),
});

export type RegisterLandlordInput = z.infer<typeof registerLandlordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
