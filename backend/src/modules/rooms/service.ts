import { Prisma, ContractStatus, RoomStatus } from '@prisma/client';
import { getTenantDb, TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import {
  RoomListQuery,
  CreateRoomInput,
  UpdateRoomInput,
  UpdateRoomStatusInput,
} from './schema';

const roomSelect = {
  id: true,
  tenantId: true,
  propertyId: true,
  roomCode: true,
  areaM2: true,
  basePrice: true,
  status: true,
  description: true,
  createdAt: true,
} satisfies Prisma.RoomSelect;

type RoomRow = Prisma.RoomGetPayload<{ select: typeof roomSelect }>;

/**
 * Q2: các trường tiền tệ Decimal (basePrice) và diện tích trả về dạng string để tránh sai số.
 */
function serializeRoom(room: RoomRow) {
  return {
    ...room,
    areaM2: room.areaM2 === null ? null : room.areaM2.toString(),
    basePrice: room.basePrice.toString(),
  };
}

function buildRoomWhere(query: RoomListQuery): Prisma.RoomWhereInput {
  const where: Prisma.RoomWhereInput = {};
  if (query.propertyId) where.propertyId = query.propertyId;
  if (query.status) where.status = query.status as RoomStatus;
  if (query.search) {
    where.roomCode = { contains: query.search, mode: 'insensitive' };
  }
  return where;
}

/**
 * Khóa dòng Tenant để tuần tự hóa bước kiểm tra giới hạn gói + INSERT (tránh race condition).
 * app_user có GRANT UPDATE ON tenants và policy tenant_self_isolation_policy (FOR ALL) cho
 * phép khóa chính dòng Tenant của mình, nên dùng được FOR UPDATE mà KHÔNG cần prismaSystem.
 */
async function lockTenantRow(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
}

export async function listRooms(context: TenantContext, query: RoomListQuery) {
  const db = getTenantDb(context);
  const where = buildRoomWhere(query);

  const total = await db.room.count({ where });
  const rows = await db.room.findMany({
    where,
    select: roomSelect,
    orderBy: { createdAt: 'desc' },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    data: rows.map(serializeRoom),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function createRoom(context: TenantContext, input: CreateRoomInput) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    await lockTenantRow(tx, context.tenantId);

    // Q1: nhà trọ phải thuộc Tenant (RLS) và đang hoạt động mới cho thêm phòng.
    const property = await tx.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, isActive: true },
    });
    if (!property) throw ApiError.notFound('PROPERTY_NOT_FOUND', 'Không tìm thấy nhà trọ');
    if (!property.isActive) {
      throw ApiError.badRequest('PROPERTY_INACTIVE', 'Nhà trọ đã bị ẩn, không thể thêm phòng');
    }

    const duplicate = await tx.room.findFirst({
      where: { propertyId: input.propertyId, roomCode: input.roomCode },
      select: { id: true },
    });
    if (duplicate) {
      throw ApiError.conflict('CONFLICT', 'Mã phòng đã tồn tại trong nhà trọ này');
    }

    const tenant = await tx.tenant.findUnique({
      where: { id: context.tenantId },
      include: { plan: true },
    });
    if (!tenant || !tenant.plan) {
      throw ApiError.notFound('PLAN_NOT_FOUND', 'Không tìm thấy gói dịch vụ của Tenant');
    }

    // Chốt 1: chỉ đếm phòng thuộc nhà trọ đang hoạt động.
    const activeRoomCount = await tx.room.count({
      where: { tenantId: context.tenantId, property: { isActive: true } },
    });
    if (activeRoomCount >= tenant.plan.maxRooms) {
      throw ApiError.forbidden(
        'PLAN_LIMIT_REACHED',
        `Bạn đã đạt giới hạn tối đa số phòng (${tenant.plan.maxRooms}) của gói ${tenant.plan.name}. Vui lòng nâng cấp gói để tạo thêm.`
      );
    }

    const room = await tx.room.create({
      data: {
        tenantId: context.tenantId,
        propertyId: input.propertyId,
        roomCode: input.roomCode,
        areaM2: input.areaM2 ?? null,
        basePrice: input.basePrice,
        description: input.description ?? null,
        status: RoomStatus.AVAILABLE,
      },
      select: roomSelect,
    });

    return serializeRoom(room);
  });
}

export async function getRoom(context: TenantContext, roomId: string) {
  const db = getTenantDb(context);
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: roomSelect,
  });

  if (!room) throw ApiError.notFound('ROOM_NOT_FOUND', 'Không tìm thấy phòng');
  return serializeRoom(room);
}

export async function updateRoom(
  context: TenantContext,
  roomId: string,
  input: UpdateRoomInput
) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const existing = await tx.room.findUnique({
      where: { id: roomId },
      select: roomSelect,
    });
    if (!existing) throw ApiError.notFound('ROOM_NOT_FOUND', 'Không tìm thấy phòng');

    let targetPropertyId = existing.propertyId;

    // Q1: chỉ chặn khi chuyển phòng sang nhà trọ đã ẩn. Sửa phòng cũ đang nằm trong
    // nhà trọ đã ẩn (không đổi propertyId) vẫn được phép.
    if (input.propertyId !== undefined && input.propertyId !== existing.propertyId) {
      // Chỉ được chuyển nhà trọ khi phòng chưa phát sinh dữ liệu nghiệp vụ
      // (hợp đồng / chỉ số điện nước / hóa đơn). Ưu tiên mã lỗi theo mức phụ thuộc
      // mạnh nhất đã có: hóa đơn > chỉ số điện nước > hợp đồng.
      const invoiceCount = await tx.invoice.count({
        where: { OR: [{ contract: { roomId } }, { meterReading: { roomId } }] },
      });
      if (invoiceCount > 0) {
        throw ApiError.conflict(
          'ROOM_HAS_INVOICE',
          'Không thể chuyển nhà trọ của phòng đã phát sinh hóa đơn',
          { invoiceCount }
        );
      }

      const meterReadingCount = await tx.meterReading.count({ where: { roomId } });
      if (meterReadingCount > 0) {
        throw ApiError.conflict(
          'ROOM_HAS_METER_READING',
          'Không thể chuyển nhà trọ của phòng đã có chỉ số điện nước',
          { meterReadingCount }
        );
      }

      const contractCount = await tx.contract.count({ where: { roomId } });
      if (contractCount > 0) {
        throw ApiError.conflict(
          'ROOM_HAS_CONTRACT',
          'Không thể chuyển nhà trọ của phòng đang có hợp đồng',
          { contractCount }
        );
      }

      const property = await tx.property.findUnique({
        where: { id: input.propertyId },
        select: { id: true, isActive: true },
      });
      if (!property) throw ApiError.notFound('PROPERTY_NOT_FOUND', 'Không tìm thấy nhà trọ');
      if (!property.isActive) {
        throw ApiError.badRequest(
          'PROPERTY_INACTIVE',
          'Nhà trọ đã bị ẩn, không thể chuyển phòng vào'
        );
      }
      targetPropertyId = input.propertyId;
    }

    const targetRoomCode = input.roomCode ?? existing.roomCode;
    if (targetPropertyId !== existing.propertyId || targetRoomCode !== existing.roomCode) {
      const duplicate = await tx.room.findFirst({
        where: {
          propertyId: targetPropertyId,
          roomCode: targetRoomCode,
          id: { not: roomId },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw ApiError.conflict('CONFLICT', 'Mã phòng đã tồn tại trong nhà trọ này');
      }
    }

    const room = await tx.room.update({
      where: { id: roomId },
      data: {
        ...(input.propertyId !== undefined && { propertyId: input.propertyId }),
        ...(input.roomCode !== undefined && { roomCode: input.roomCode }),
        ...(input.areaM2 !== undefined && { areaM2: input.areaM2 }),
        ...(input.basePrice !== undefined && { basePrice: input.basePrice }),
        ...(input.description !== undefined && { description: input.description }),
      },
      select: roomSelect,
    });

    return serializeRoom(room);
  });
}

export async function updateRoomStatus(
  context: TenantContext,
  roomId: string,
  input: UpdateRoomStatusInput
) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: roomSelect,
    });
    if (!room) throw ApiError.notFound('ROOM_NOT_FOUND', 'Không tìm thấy phòng');

    // Rule 8: không đổi trạng thái phòng đang có hợp đồng ACTIVE.
    const activeContract = await tx.contract.findFirst({
      where: { roomId, status: ContractStatus.ACTIVE },
      select: { id: true },
    });
    if (activeContract) {
      throw ApiError.conflict(
        'ROOM_HAS_ACTIVE_CONTRACT',
        'Không thể đổi trạng thái phòng đang có hợp đồng hiệu lực'
      );
    }

    const updated = await tx.room.update({
      where: { id: roomId },
      data: { status: input.status as RoomStatus },
      select: roomSelect,
    });

    return serializeRoom(updated);
  });
}
