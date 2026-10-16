import { Prisma, ContractStatus, RoomStatus, UserRole } from '@prisma/client';
import { getTenantDb, TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import {
  ContractListQuery,
  CreateContractInput,
  UpdateContractInput,
  TerminateContractInput,
} from './schema';

const contractSelect = {
  id: true,
  tenantId: true,
  roomId: true,
  renterId: true,
  startDate: true,
  endDate: true,
  monthlyRent: true,
  deposit: true,
  terms: true,
  status: true,
  terminatedReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContractSelect;

type ContractRow = Prisma.ContractGetPayload<{ select: typeof contractSelect }>;

// Q2: chi tiết trả kèm room (phẳng, có propertyName) và renter (KHÔNG passwordHash/nationalId).
const contractDetailSelect = {
  ...contractSelect,
  room: {
    select: {
      id: true,
      roomCode: true,
      propertyId: true,
      property: { select: { id: true, name: true } },
    },
  },
  renter: { select: { id: true, fullName: true, email: true, phone: true } },
} satisfies Prisma.ContractSelect;

type ContractDetailRow = Prisma.ContractGetPayload<{ select: typeof contractDetailSelect }>;

/**
 * Q2/Phần C: tiền tệ Decimal (monthlyRent, deposit) trả JSON dạng string.
 */
function serializeContract(contract: ContractRow) {
  return {
    ...contract,
    monthlyRent: contract.monthlyRent.toString(),
    deposit: contract.deposit.toString(),
  };
}

function serializeContractDetail(contract: ContractDetailRow) {
  const { room, renter, ...rest } = contract;
  return {
    ...serializeContract(rest),
    room: {
      id: room.id,
      roomCode: room.roomCode,
      propertyId: room.propertyId,
      propertyName: room.property.name,
    },
    renter,
  };
}

function buildContractWhere(query: ContractListQuery): Prisma.ContractWhereInput {
  const where: Prisma.ContractWhereInput = {};
  if (query.roomId) where.roomId = query.roomId;
  if (query.renterId) where.renterId = query.renterId;
  if (query.status) where.status = query.status;
  if (query.propertyId) where.room = { propertyId: query.propertyId };
  return where;
}

function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  );
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateOnlyToString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function listContracts(context: TenantContext, query: ContractListQuery) {
  const db = getTenantDb(context);
  const where = buildContractWhere(query);

  const total = await db.contract.count({ where });
  const rows = await db.contract.findMany({
    where,
    select: contractSelect,
    orderBy: { createdAt: 'desc' },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    data: rows.map(serializeContract),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

/**
 * UC15: Tạo hợp đồng. Tạo Contract + chuyển Room sang OCCUPIED trong MỘT transaction
 * (không cần khóa dòng Tenant vì không liên quan giới hạn gói).
 */
export async function createContract(context: TenantContext, input: CreateContractInput) {
  const db = getTenantDb(context);

  // Q1: endDate phải lớn hơn startDate (startDate quá khứ thì vẫn cho phép).
  if (input.endDate <= input.startDate) {
    throw ApiError.badRequest(
      'INVALID_DATE_RANGE',
      'Ngày kết thúc phải lớn hơn ngày bắt đầu'
    );
  }

  try {
    return await db.tenantTransaction(async (tx) => {
      // renterId phải trỏ tới User RENTER trong cùng Tenant (RLS tự lọc Tenant khác).
      const renter = await tx.user.findUnique({
        where: { id: input.renterId },
        select: { id: true, role: true },
      });
      if (!renter || renter.role !== UserRole.RENTER) {
        throw ApiError.badRequest(
          'INVALID_RENTER',
          'renterId không hợp lệ: người dùng không tồn tại hoặc không phải Người thuê'
        );
      }

      const room = await tx.room.findUnique({
        where: { id: input.roomId },
        select: {
          id: true,
          roomCode: true,
          status: true,
          property: { select: { isActive: true } },
        },
      });
      if (!room) throw ApiError.notFound('ROOM_NOT_FOUND', 'Không tìm thấy phòng');

      // Nhà trọ của phòng đã bị ẩn -> không thể tạo hợp đồng mới.
      if (!room.property.isActive) {
        throw ApiError.badRequest(
          'PROPERTY_INACTIVE',
          'Nhà trọ của phòng đã bị ẩn, không thể tạo hợp đồng'
        );
      }

      // Phòng đang bảo trì -> không khả dụng.
      if (room.status === RoomStatus.MAINTENANCE) {
        throw ApiError.conflict(
          'ROOM_NOT_AVAILABLE',
          'Phòng đang bảo trì, không thể tạo hợp đồng'
        );
      }

      const contract = await tx.contract.create({
        data: {
          tenantId: context.tenantId,
          roomId: input.roomId,
          renterId: input.renterId,
          startDate: toDateOnly(input.startDate),
          endDate: toDateOnly(input.endDate),
          monthlyRent: input.monthlyRent,
          deposit: input.deposit,
          terms: input.terms ?? null,
          status: ContractStatus.ACTIVE,
        },
        select: contractSelect,
      });

      // Cùng transaction: phòng vừa có hợp đồng ACTIVE -> OCCUPIED.
      await tx.room.update({
        where: { id: input.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      return serializeContract(contract);
    });
  } catch (err) {
    // Partial unique index uq_contract_active_room (mỗi phòng chỉ 1 hợp đồng ACTIVE).
    if (isUniqueViolation(err)) {
      throw ApiError.conflict(
        'ROOM_ALREADY_OCCUPIED',
        'Phòng đã có hợp đồng hiệu lực, không thể tạo hợp đồng mới'
      );
    }
    throw err;
  }
}

export async function getContract(context: TenantContext, contractId: string) {
  const db = getTenantDb(context);
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    select: contractDetailSelect,
  });

  if (!contract) throw ApiError.notFound('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng');
  return serializeContractDetail(contract);
}

/**
 * Sửa hợp đồng: chỉ sửa được hợp đồng ACTIVE; không đổi roomId/renterId/startDate.
 */
export async function updateContract(
  context: TenantContext,
  contractId: string,
  input: UpdateContractInput
) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const existing = await tx.contract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, startDate: true },
    });
    if (!existing) throw ApiError.notFound('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng');
    if (existing.status !== ContractStatus.ACTIVE) {
      throw ApiError.conflict(
        'CONTRACT_NOT_ACTIVE',
        'Chỉ chỉnh sửa được hợp đồng đang hiệu lực'
      );
    }

    if (input.endDate !== undefined && input.endDate <= dateOnlyToString(existing.startDate)) {
      throw ApiError.badRequest(
        'INVALID_DATE_RANGE',
        'Ngày kết thúc phải lớn hơn ngày bắt đầu'
      );
    }

    const updated = await tx.contract.update({
      where: { id: contractId },
      data: {
        ...(input.endDate !== undefined && { endDate: toDateOnly(input.endDate) }),
        ...(input.monthlyRent !== undefined && { monthlyRent: input.monthlyRent }),
        ...(input.deposit !== undefined && { deposit: input.deposit }),
        ...(input.terms !== undefined && { terms: input.terms }),
      },
      select: contractSelect,
    });

    return serializeContract(updated);
  });
}

/**
 * Chấm dứt hợp đồng sớm: status = TERMINATED + Room -> AVAILABLE trong MỘT transaction.
 * reason lưu vào cột terminated_reason (đã thêm migration riêng).
 */
export async function terminateContract(
  context: TenantContext,
  contractId: string,
  input: TerminateContractInput
) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const existing = await tx.contract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, roomId: true },
    });
    if (!existing) throw ApiError.notFound('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng');
    if (existing.status !== ContractStatus.ACTIVE) {
      throw ApiError.conflict(
        'CONTRACT_NOT_ACTIVE',
        'Chỉ chấm dứt được hợp đồng đang hiệu lực'
      );
    }

    const updated = await tx.contract.update({
      where: { id: contractId },
      data: {
        status: ContractStatus.TERMINATED,
        terminatedReason: input.reason || null,
      },
      select: contractSelect,
    });

    // Cùng transaction: trả phòng về AVAILABLE.
    await tx.room.update({
      where: { id: existing.roomId },
      data: { status: RoomStatus.AVAILABLE },
    });

    return serializeContract(updated);
  });
}

/**
 * Kết thúc hợp đồng theo kỳ: status = ENDED + Room -> AVAILABLE trong MỘT transaction.
 */
export async function endContract(context: TenantContext, contractId: string) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const existing = await tx.contract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, roomId: true },
    });
    if (!existing) throw ApiError.notFound('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng');
    if (existing.status !== ContractStatus.ACTIVE) {
      throw ApiError.conflict(
        'CONTRACT_NOT_ACTIVE',
        'Chỉ kết thúc được hợp đồng đang hiệu lực'
      );
    }

    const updated = await tx.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.ENDED },
      select: contractSelect,
    });

    await tx.room.update({
      where: { id: existing.roomId },
      data: { status: RoomStatus.AVAILABLE },
    });

    return serializeContract(updated);
  });
}
