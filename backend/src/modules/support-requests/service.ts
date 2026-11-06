import { ContractStatus, Prisma, SupportStatus, UserRole } from '@prisma/client';
import { getTenantDb, prismaSystem, type TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import type {
  CreateSupportRequestInput,
  RespondSupportRequestInput,
  SupportRequestListQuery,
} from './schema';

const supportRequestSelect = {
  id: true,
  renterId: true,
  type: true,
  title: true,
  content: true,
  status: true,
  response: true,
  respondedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupportRequestSelect;

type SupportRequestRow = Prisma.SupportRequestGetPayload<{ select: typeof supportRequestSelect }>;

// Chi tiết cho Landlord: kèm người thuê (KHÔNG email/SĐT/CCCD) và phòng hiện tại của hợp đồng ACTIVE.
const supportRequestDetailSelect = {
  ...supportRequestSelect,
  renter: { select: { id: true, fullName: true } },
} satisfies Prisma.SupportRequestSelect;

type SupportRequestDetailRow = Prisma.SupportRequestGetPayload<{
  select: typeof supportRequestDetailSelect;
}>;

function serializeSupportRequest(row: SupportRequestRow) {
  return { ...row };
}

/**
 * userId CHỈ lấy từ JWT đã xác thực; KHÔNG nhận từ query/body.
 */
function requireUserId(context: TenantContext): string {
  if (!context.userId) {
    throw ApiError.forbidden('NO_USER', 'Tài khoản không hợp lệ');
  }
  return context.userId;
}

function isLandlord(context: TenantContext): boolean {
  return context.role === UserRole.LANDLORD;
}

/**
 * UC33: Renter gửi phản ánh.
 * - Điều kiện: Renter phải đang có hợp đồng ACTIVE (không thì 409 NO_ACTIVE_CONTRACT).
 * - Luật 12: KHÔNG chặn khi Tenant hết hạn — phản ánh là dữ liệu do Renter tạo (báo sự cố),
 *   không phải dữ liệu vận hành của Landlord (Tenant SUSPENDED đã bị middleware chặn).
 * - Ghi bằng getTenantDb (app_user + RLS: WITH CHECK cho phép chèn dòng renter_id của chính mình).
 */
export async function createSupportRequest(
  context: TenantContext,
  input: CreateSupportRequestInput
) {
  const db = getTenantDb(context);
  const renterId = requireUserId(context);

  const activeContract = await db.contract.findFirst({
    where: { renterId, status: ContractStatus.ACTIVE },
    select: { id: true },
  });
  if (!activeContract) {
    throw ApiError.conflict(
      'NO_ACTIVE_CONTRACT',
      'Bạn cần có hợp đồng đang hiệu lực để gửi phản ánh'
    );
  }

  const created = await db.supportRequest.create({
    data: {
      tenantId: context.tenantId,
      renterId,
      type: input.type,
      title: input.title,
      content: input.content,
    },
    select: supportRequestSelect,
  });

  // Luật 13: Renter ghi notification cho Landlord (người khác) — dùng prismaSystem (app_system, BYPASSRLS).
  // tenantId lấy từ JWT đã xác thực; KHÔNG nới lỏng RLS để Renter tự ghi. Lỗi chỉ log.
  try {
    const landlord = await prismaSystem.user.findFirst({
      where: { tenantId: context.tenantId, role: UserRole.LANDLORD },
      select: { id: true },
    });
    if (landlord) {
      await prismaSystem.notification.create({
        data: {
          tenantId: context.tenantId,
          userId: landlord.id,
          type: 'NEW_SUPPORT_REQUEST',
          title: 'Phản ánh mới',
          content: `Phản ánh "${created.title}" vừa được gửi từ người thuê.`,
          entityId: created.id,
        },
      });
    }
  } catch (err) {
    console.error('[SupportRequestNotification]', err);
  }

  return serializeSupportRequest(created);
}

export async function listSupportRequests(
  context: TenantContext,
  query: SupportRequestListQuery
) {
  const db = getTenantDb(context);
  const where: Prisma.SupportRequestWhereInput = {};

  // RLS đã lọc theo tenant; Renter chỉ thấy phản ánh của mình (RLS lọc renter_id = app.current_user_id).
  if (!isLandlord(context) && query.renterId) {
    // Renter không được tự lọc theo renterId khác.
    throw ApiError.forbidden('FORBIDDEN', 'Bạn không có quyền lọc theo người thuê khác');
  }
  if (isLandlord(context) && query.renterId) {
    where.renterId = query.renterId;
  }
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;

  const total = await db.supportRequest.count({ where });
  const rows = await db.supportRequest.findMany({
    where,
    select: supportRequestSelect,
    orderBy: [{ createdAt: 'desc' }],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    data: rows.map(serializeSupportRequest),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

/**
 * Chi tiết: Renter (RLS) chỉ thấy của mình; Landlord thấy trong Tenant (RLS).
 * Landlord được kèm người thuê + phòng hiện tại của hợp đồng ACTIVE; KHÔNG email/SĐT/CCCD.
 */
export async function getSupportRequest(context: TenantContext, id: string) {
  const db = getTenantDb(context);

  const row = await db.supportRequest.findUnique({
    where: { id },
    select: isLandlord(context) ? supportRequestDetailSelect : supportRequestSelect,
  });
  if (!row) {
    throw ApiError.notFound('SUPPORT_REQUEST_NOT_FOUND', 'Không tìm thấy phản ánh');
  }

  if (!isLandlord(context)) {
    return serializeSupportRequest(row as SupportRequestRow);
  }

  const detail = row as SupportRequestDetailRow;

  const activeContract = await db.contract.findFirst({
    where: { renterId: detail.renterId, status: ContractStatus.ACTIVE },
    select: {
      room: { select: { roomCode: true, property: { select: { name: true } } } },
    },
  });

  return {
    ...serializeSupportRequest(detail),
    renter: { id: detail.renter.id, fullName: detail.renter.fullName },
    room: activeContract
      ? {
          roomCode: activeContract.room.roomCode,
          propertyName: activeContract.room.property.name,
        }
      : null,
  };
}

/**
 * UC20: Landlord phản hồi và đổi trạng thái.
 * - RESOLVED bắt buộc có response (400 RESPONSE_REQUIRED).
 * - RESOLVED là trạng thái cuối; sửa tiếp -> 409 SUPPORT_REQUEST_CLOSED.
 * - Idempotent: gửi lại đúng trạng thái hiện tại và cùng nội dung -> 200, không đổi gì.
 * - Ghi Notification cho Renter SAU commit bằng getTenantDb (luật 19: cùng Tenant, app_user đủ).
 */
export async function respondSupportRequest(
  context: TenantContext,
  id: string,
  input: RespondSupportRequestInput
) {
  const db = getTenantDb(context);

  const existing = await db.supportRequest.findUnique({
    where: { id },
    select: { id: true, status: true, response: true, renterId: true, title: true },
  });
  if (!existing) {
    throw ApiError.notFound('SUPPORT_REQUEST_NOT_FOUND', 'Không tìm thấy phản ánh');
  }

  const nextResponse = input.response ?? existing.response ?? null;

  if (existing.status === SupportStatus.RESOLVED) {
    // Idempotent: đúng trạng thái RESOLVED và cùng nội dung -> trả nguyên trạng.
    if (input.status === SupportStatus.RESOLVED && nextResponse === existing.response) {
      const row = await db.supportRequest.findUnique({
        where: { id },
        select: supportRequestSelect,
      });
      return serializeSupportRequest(row as SupportRequestRow);
    }
    throw ApiError.conflict(
      'SUPPORT_REQUEST_CLOSED',
      'Phản ánh đã được xử lý xong, không thể cập nhật tiếp'
    );
  }

  if (input.status === SupportStatus.RESOLVED && !input.response) {
    throw ApiError.badRequest(
      'RESPONSE_REQUIRED',
      'Cần có nội dung phản hồi khi đánh dấu đã xử lý'
    );
  }

  const data: Prisma.SupportRequestUpdateInput = { status: input.status };
  if (input.response !== undefined) {
    data.response = input.response;
    data.respondedAt = new Date();
  }

  const updated = await db.supportRequest.update({
    where: { id },
    data,
    select: supportRequestSelect,
  });

  // Luật 19: Landlord phản hồi cho Renter trong cùng Tenant — app_user + RLS là đủ (không cần prismaSystem).
  // Lỗi chỉ log, không làm hỏng cập nhật.
  try {
    await db.notification.create({
      data: {
        tenantId: context.tenantId,
        userId: existing.renterId,
        type: 'SUPPORT_REQUEST_RESPONDED',
        title: 'Phản ánh đã được phản hồi',
        content: `Phản ánh "${existing.title}" đã được ban quản lý cập nhật trạng thái.`,
        entityId: existing.id,
      },
    });
  } catch (err) {
    console.error('[SupportRequestNotification]', err);
  }

  return serializeSupportRequest(updated);
}
