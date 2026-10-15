import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prismaSystem, getTenantDb } from '../../lib/db';
import { signToken } from '../../lib/jwt';
import { sendMail } from '../../lib/mail';
import { ApiError } from '../../lib/ApiError';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';
import {
  RegisterLandlordInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from './schema';

// Helper select loại trừ hoàn toàn passwordHash
const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  nationalId: true,
  role: true,
  status: true,
  tenantId: true,
  lastLoginAt: true,
  createdAt: true,
};

/**
 * UC08: Đăng ký tài khoản Landlord (Chủ nhà trọ)
 * Luật 11: Tạo Tenant (gói mặc định, hạn dùng thử) + User LANDLORD trong MỘT transaction.
 */
export async function registerLandlord(input: RegisterLandlordInput) {
  const existingUser = await prismaSystem.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw ApiError.conflict('EMAIL_ALREADY_USED', 'Email này đã được sử dụng trong hệ thống');
  }

  // Đọc cấu hình từ .env
  const defaultPlanName = process.env.DEFAULT_PLAN_NAME || 'Cơ bản';
  const trialDays = parseInt(process.env.TRIAL_DAYS || '14', 10);
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

  const plan = await prismaSystem.plan.findFirst({
    where: { name: defaultPlanName, isActive: true },
  });

  if (!plan) {
    throw ApiError.internal(
      'DEFAULT_PLAN_UNAVAILABLE',
      `Gói dịch vụ mặc định '${defaultPlanName}' không tồn tại hoặc đã bị ẩn.`
    );
  }

  const now = new Date();
  const subscriptionEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  const passwordHash = await bcrypt.hash(input.password, bcryptRounds);

  // Thực hiện tạo Tenant + User trong MỘT transaction duy nhất bằng prismaSystem (BYPASSRLS)
  const result = await prismaSystem.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.tenantName,
        planId: plan.id,
        status: TenantStatus.ACTIVE,
        subscriptionStart: now,
        subscriptionEnd: subscriptionEnd,
      },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email,
        passwordHash: passwordHash,
        fullName: input.fullName,
        phone: input.phone || null,
        nationalId: input.nationalId || null,
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
      select: safeUserSelect,
    });

    return { user, tenant };
  });

  const token = signToken({
    userId: result.user.id,
    role: result.user.role,
    tenantId: result.tenant.id,
  });

  return {
    token,
    user: result.user,
    tenant: result.tenant,
  };
}

/**
 * UC01, UC09, UC24: Đăng nhập hệ thống
 * Luật 10: Kiểm tra thứ tự: sai mật khẩu → tài khoản bị khóa → Tenant tạm ngưng (bỏ qua với Admin).
 */
export async function login(input: LoginInput) {
  // Tìm người dùng bằng prismaSystem (Auth module được dùng BYPASSRLS)
  const user = await prismaSystem.user.findUnique({
    where: { email: input.email },
  });

  // 1. Kiểm tra tồn tại và mật khẩu
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác');
  }

  // 2. Kiểm tra tài khoản bị khóa
  if (user.status === UserStatus.LOCKED) {
    throw ApiError.unauthorized(
      'ACCOUNT_LOCKED',
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.'
    );
  }

  // 3. Kiểm tra Tenant bị tạm ngưng (Bỏ qua với Admin)
  let tenant = null;
  if (user.role !== UserRole.ADMIN && user.tenantId) {
    tenant = await prismaSystem.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant || tenant.status === TenantStatus.SUSPENDED) {
      throw ApiError.unauthorized('TENANT_SUSPENDED', 'Hệ thống nhà trọ của bạn đang bị tạm ngưng.');
    }
  }

  // Cập nhật lastLoginAt
  await prismaSystem.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signToken({
    userId: user.id,
    role: user.role,
    tenantId: user.tenantId,
  });

  const { passwordHash, ...safeUser } = user;

  return {
    token,
    user: safeUser,
    tenant,
  };
}

/**
 * UC02, UC10, UC25: Quên mật khẩu
 * Trả thông báo chung chống user enumeration. Token lưu dạng băm sha256.
 */
export async function forgotPassword(input: ForgotPasswordInput) {
  const genericResponse = {
    message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến bạn.',
  };

  const user = await prismaSystem.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    return genericResponse;
  }

  // Sinh token ngẫu nhiên
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiryMinutes = parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || '30', 10);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await prismaSystem.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: tokenHash,
      expiresAt: expiresAt,
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

  await sendMail({
    to: user.email,
    subject: 'Yêu cầu đặt lại mật khẩu - Quản lý nhà trọ SaaS',
    text: `Chào ${user.fullName},\n\nBạn vừa yêu cầu đặt lại mật khẩu. Vui lòng bấm vào liên kết sau (hạn trong ${expiryMinutes} phút):\n${resetLink}\n\nNếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.`,
    html: `<p>Chào <b>${user.fullName}</b>,</p><p>Bạn vừa yêu cầu đặt lại mật khẩu. Vui lòng bấm vào liên kết dưới đây để đổi mật khẩu (hạn ${expiryMinutes} phút):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
  });

  return genericResponse;
}

/**
 * Đặt lại mật khẩu với token
 */
export async function resetPassword(input: ResetPasswordInput) {
  const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

  const resetRecord = await prismaSystem.passwordResetToken.findFirst({
    where: {
      tokenHash: tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!resetRecord) {
    throw ApiError.badRequest(
      'INVALID_RESET_TOKEN',
      'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'
    );
  }

  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  const passwordHash = await bcrypt.hash(input.newPassword, bcryptRounds);

  await prismaSystem.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash: passwordHash },
    });

    await tx.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });
  });

  return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.' };
}

/**
 * UC03, UC11, UC26: Lấy hồ sơ cá nhân
 * Đi qua RLS context nếu là Landlord/Renter. Admin đi qua prismaSystem.
 */
export async function getProfile(userId: string, role: UserRole, tenantId: string | null) {
  if (role === UserRole.ADMIN || !tenantId) {
    const user = await prismaSystem.user.findUnique({
      where: { id: userId },
      select: safeUserSelect,
    });
    if (!user) throw ApiError.notFound('PROFILE_NOT_FOUND', 'Không tìm thấy người dùng');
    return user;
  }

  const db = getTenantDb({ tenantId, userId, role });
  const user = await db.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  if (!user) throw ApiError.notFound('PROFILE_NOT_FOUND', 'Không tìm thấy thông tin hồ sơ');
  return user;
}

/**
 * Cập nhật hồ sơ cá nhân
 */
export async function updateProfile(
  userId: string,
  role: UserRole,
  tenantId: string | null,
  input: UpdateProfileInput
) {
  const updateData: { fullName?: string; phone?: string | null; nationalId?: string | null } = {};
  if (input.fullName !== undefined) updateData.fullName = input.fullName;
  if (input.phone !== undefined) updateData.phone = input.phone || null;
  if (input.nationalId !== undefined) updateData.nationalId = input.nationalId || null;

  if (role === UserRole.ADMIN || !tenantId) {
    return prismaSystem.user.update({
      where: { id: userId },
      data: updateData,
      select: safeUserSelect,
    });
  }

  const db = getTenantDb({ tenantId, userId, role });
  return db.user.update({
    where: { id: userId },
    data: updateData,
    select: safeUserSelect,
  });
}

/**
 * Đổi mật khẩu
 */
export async function changePassword(
  userId: string,
  role: UserRole,
  tenantId: string | null,
  input: ChangePasswordInput
) {
  const user = await prismaSystem.user.findUnique({
    where: { id: userId },
  });

  if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không chính xác');
  }

  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  const passwordHash = await bcrypt.hash(input.newPassword, bcryptRounds);

  if (role === UserRole.ADMIN || !tenantId) {
    await prismaSystem.user.update({
      where: { id: userId },
      data: { passwordHash: passwordHash },
    });
  } else {
    const db = getTenantDb({ tenantId, userId, role });
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: passwordHash },
    });
  }

  return { message: 'Đổi mật khẩu thành công' };
}
