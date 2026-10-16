import crypto from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { prismaSystem, getTenantDb, TenantContext } from '../../lib/db';
import { sendMail } from '../../lib/mail';
import { ApiError } from '../../lib/ApiError';
import { RenterListQuery, CreateRenterInput, UpdateRenterInput } from './schema';

/**
 * Chọn tường minh: KHÔNG trả passwordHash. nationalId (số CCCD) được đưa vào
 * nhưng LUÔN bị che ở danh sách; chỉ GET chi tiết mới trả đầy đủ cho Landlord
 * của chính Tenant đó. TUYỆT ĐỐI không ghi nationalId vào log (Luật 9).
 */
const renterSelect = {
  id: true,
  tenantId: true,
  email: true,
  fullName: true,
  phone: true,
  nationalId: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type RenterRow = Prisma.UserGetPayload<{ select: typeof renterSelect }>;

/**
 * Che một phần số CCCD, ví dụ 079012345678 -> 0790••••••78.
 * Giữ 4 ký tự đầu và 2 ký tự cuối (nếu đủ dài).
 */
function maskNationalId(value: string | null): string | null {
  if (!value) return value;
  if (value.length <= 4) return '•'.repeat(value.length);
  const head = value.slice(0, 4);
  const tail = value.length >= 8 ? value.slice(-2) : '';
  return head + '•'.repeat(value.length - head.length - tail.length) + tail;
}

/** Bản che CCCD: dùng cho danh sách và các response không phải chi tiết. */
function serializeRenter(renter: RenterRow) {
  return { ...renter, nationalId: maskNationalId(renter.nationalId) };
}

/** Bản đầy đủ CCCD: CHỈ dùng cho GET /api/renters/:id của Landlord cùng Tenant. */
function serializeRenterDetail(renter: RenterRow) {
  return { ...renter };
}

function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  );
}

function mapUserUniqueViolation(err: Prisma.PrismaClientKnownRequestError): ApiError {
  // meta.target có thể là tên field (['phone']) hoặc tên constraint
  // (['uq_user_tenant_phone']) tùy phiên bản Prisma — tra cả hai.
  const target = JSON.stringify(err.meta ?? {}).toLowerCase();
  if (target.includes('phone')) {
    throw ApiError.conflict('PHONE_CONFLICT', 'Số điện thoại đã tồn tại trong hệ thống');
  }
  if (target.includes('national')) {
    throw ApiError.conflict('NATIONAL_ID_CONFLICT', 'Số CCCD đã tồn tại trong hệ thống');
  }
  if (target.includes('email')) {
    throw ApiError.conflict('EMAIL_CONFLICT', 'Email này đã được sử dụng trong hệ thống');
  }
  throw ApiError.conflict('CONFLICT', 'Dữ liệu đã tồn tại, vi phạm ràng buộc duy nhất');
}

function buildRenterWhere(query: RenterListQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: UserRole.RENTER };
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

export async function listRenters(context: TenantContext, query: RenterListQuery) {
  const db = getTenantDb(context);
  const where = buildRenterWhere(query);

  const total = await db.user.count({ where });
  const rows = await db.user.findMany({
    where,
    select: renterSelect,
    orderBy: { createdAt: 'desc' },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    data: rows.map(serializeRenter),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

/**
 * UC14: Tạo người thuê (User RENTER) + gửi email mời đặt mật khẩu.
 *
 * Luật 13: đây là hành động của Landlord ghi dữ liệu (User RENTER) và
 * PasswordResetToken cho người khác trong Tenant, nhưng email là unique TOÀN CẦU
 * nên cần kiểm tra trước mặt RLS. Vì vậy dùng prismaSystem (BYPASSRLS) và LUÔN
 * truyền tenantId lấy từ JWT đã xác thực (context.tenantId) vào data — KHÔNG nhận
 * từ body/query.
 *
 * Các bước DB (tạo User + tạo PasswordResetToken) nằm trong MỘT transaction;
 * gửi email chạy SAU khi transaction commit để SMTP không giữ transaction quá lâu.
 */
export async function createRenter(context: TenantContext, input: CreateRenterInput) {
  const phone = input.phone || null;
  const nationalId = input.nationalId || null;

  const inviteHours = parseInt(process.env.INVITE_TOKEN_EXPIRES_HOURS || '48', 10);

  const existingEmail = await prismaSystem.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existingEmail) {
    throw ApiError.conflict('EMAIL_CONFLICT', 'Email này đã được sử dụng trong hệ thống');
  }

  let rawToken = '';
  let user: RenterRow;

  try {
    const result = await prismaSystem.$transaction(async (tx) => {
      if (phone) {
        const duplicatePhone = await tx.user.findFirst({
          where: { tenantId: context.tenantId, phone },
          select: { id: true },
        });
        if (duplicatePhone) {
          throw ApiError.conflict('PHONE_CONFLICT', 'Số điện thoại đã tồn tại trong hệ thống');
        }
      }
      if (nationalId) {
        const duplicateNationalId = await tx.user.findFirst({
          where: { tenantId: context.tenantId, nationalId },
          select: { id: true },
        });
        if (duplicateNationalId) {
          throw ApiError.conflict(
            'NATIONAL_ID_CONFLICT',
            'Số CCCD đã tồn tại trong hệ thống'
          );
        }
      }

      const created = await tx.user.create({
        data: {
          tenantId: context.tenantId,
          email: input.email,
          passwordHash: '',
          fullName: input.fullName,
          phone,
          nationalId,
          role: UserRole.RENTER,
        },
        select: renterSelect,
      });

      // Dùng lại flow reset-password (Q3): token lưu dạng băm sha256,
      // rawToken chỉ xuất hiện trong email mời.
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await tx.passwordResetToken.create({
        data: {
          userId: created.id,
          tokenHash,
          expiresAt: new Date(Date.now() + inviteHours * 60 * 60 * 1000),
        },
      });

      return { created, token };
    });

    user = result.created;
    rawToken = result.token;
  } catch (err) {
    if (isUniqueViolation(err)) mapUserUniqueViolation(err);
    throw err;
  }

  await sendInviteEmail(user, rawToken, inviteHours);

  return { user: serializeRenter(user), inviteTokenSent: true };
}

/**
 * Gửi email mời đặt mật khẩu. Chạy SAU khi transaction commit để SMTP không giữ
 * transaction lâu. Không ghi số CCCD hay token ra log (Luật 9).
 */
async function sendInviteEmail(
  user: { email: string; fullName: string },
  rawToken: string,
  inviteHours: number
): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

  await sendMail({
    to: user.email,
    subject: 'Mời đặt mật khẩu - Quản lý nhà trọ SaaS',
    text: `Chào ${user.fullName},\n\nBạn được mời vào hệ thống quản lý nhà trọ. Vui lòng đặt mật khẩu trong vòng ${inviteHours} giờ qua liên kết sau:\n${resetLink}\n\nNếu bạn không yêu cầu tài khoản này, vui lòng bỏ qua email.`,
    html: `<p>Chào <b>${user.fullName}</b>,</p><p>Bạn được mời vào hệ thống quản lý nhà trọ. Vui lòng đặt mật khẩu (hạn ${inviteHours} giờ) qua liên kết:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
  });
}

/**
 * GET /api/renters/:id — Landlord của chính Tenant xem chi tiết, gồm số CCCD
 * ĐẦY ĐỦ. RLS giới hạn theo tenant nên Landlord Tenant khác nhận 404; Admin và
 * Renter bị chặn ở tầng route (requireRole LANDLORD).
 */
export async function getRenter(context: TenantContext, renterId: string) {
  const db = getTenantDb(context);
  const renter = await db.user.findUnique({
    where: { id: renterId },
    select: renterSelect,
  });

  if (!renter || renter.role !== UserRole.RENTER) {
    throw ApiError.notFound('RENTER_NOT_FOUND', 'Không tìm thấy người thuê');
  }
  return serializeRenterDetail(renter);
}

export async function updateRenter(
  context: TenantContext,
  renterId: string,
  input: UpdateRenterInput
) {
  const db = getTenantDb(context);

  try {
    return await db.tenantTransaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: renterId },
        select: { id: true, role: true },
      });
      if (!existing || existing.role !== UserRole.RENTER) {
        throw ApiError.notFound('RENTER_NOT_FOUND', 'Không tìm thấy người thuê');
      }

      const phone = input.phone !== undefined ? input.phone || null : undefined;
      const nationalId = input.nationalId !== undefined ? input.nationalId || null : undefined;

      if (phone) {
        const duplicatePhone = await tx.user.findFirst({
          where: { tenantId: context.tenantId, phone, id: { not: renterId } },
          select: { id: true },
        });
        if (duplicatePhone) {
          throw ApiError.conflict('PHONE_CONFLICT', 'Số điện thoại đã tồn tại trong hệ thống');
        }
      }
      if (nationalId) {
        const duplicateNationalId = await tx.user.findFirst({
          where: { tenantId: context.tenantId, nationalId, id: { not: renterId } },
          select: { id: true },
        });
        if (duplicateNationalId) {
          throw ApiError.conflict(
            'NATIONAL_ID_CONFLICT',
            'Số CCCD đã tồn tại trong hệ thống'
          );
        }
      }

      const updated = await tx.user.update({
        where: { id: renterId },
        data: {
          ...(input.fullName !== undefined && { fullName: input.fullName }),
          ...(phone !== undefined && { phone }),
          ...(nationalId !== undefined && { nationalId }),
        },
        select: renterSelect,
      });

      return serializeRenter(updated);
    });
  } catch (err) {
    if (isUniqueViolation(err)) mapUserUniqueViolation(err);
    throw err;
  }
}

/**
 * POST /api/renters/:id/resend-invite — gửi lại lời mời đặt mật khẩu.
 *
 * Chỉ áp dụng khi Renter CHƯA từng đăng nhập (lastLoginAt rỗng); ngược lại
 * 409 INVITE_NOT_APPLICABLE. Vô hiệu hóa token mời cũ rồi tạo token mới.
 *
 * Luật 13: đây là hành động của Landlord ghi PasswordResetToken cho người khác;
 * dùng prismaSystem (BYPASSRLS) và LUÔN truyền tenantId lấy từ JWT đã xác thực
 * (context.tenantId) — KHÔNG nhận từ body/query/params — để chặn Tenant khác
 * (người thuê Tenant khác trả 404, không lộ sự tồn tại). Việc ghi (vô hiệu hóa
 * token cũ + tạo token mới) nằm trong MỘT transaction; gửi email chạy SAU khi
 * commit để SMTP không giữ transaction lâu.
 */
export async function resendInvite(context: TenantContext, renterId: string) {
  const inviteHours = parseInt(process.env.INVITE_TOKEN_EXPIRES_HOURS || '48', 10);

  let user: RenterRow;
  let rawToken = '';

  const result = await prismaSystem.$transaction(async (tx) => {
    const renter = await tx.user.findFirst({
      where: { id: renterId, tenantId: context.tenantId, role: UserRole.RENTER },
      select: renterSelect,
    });
    if (!renter) {
      throw ApiError.notFound('RENTER_NOT_FOUND', 'Không tìm thấy người thuê');
    }
    if (renter.lastLoginAt) {
      throw ApiError.conflict(
        'INVITE_NOT_APPLICABLE',
        'Người thuê đã đăng nhập nên không thể gửi lại lời mời đặt mật khẩu'
      );
    }

    // Vô hiệu hóa toàn bộ token mời cũ còn hiệu lực của người thuê này.
    await tx.passwordResetToken.updateMany({
      where: { userId: renter.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await tx.passwordResetToken.create({
      data: {
        userId: renter.id,
        tokenHash,
        expiresAt: new Date(Date.now() + inviteHours * 60 * 60 * 1000),
      },
    });

    return { renter, token };
  });

  user = result.renter;
  rawToken = result.token;

  await sendInviteEmail(user, rawToken, inviteHours);

  return { user: serializeRenter(user), inviteTokenSent: true };
}
