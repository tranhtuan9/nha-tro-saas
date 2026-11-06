import { UserRole } from '@prisma/client';
import type { TenantPrismaClient } from '../../lib/db';

/**
 * Phân giải mã hiệu (mã phòng, tên nhà trọ, tên người thuê, tên dịch vụ) thành id
 * trong Tenant của JWT. Nhận DB đã bọc RLS (getTenantDb) — KHÔNG nhận tenantId từ AI.
 * Mơ hồ (0 hoặc nhiều ứng viên) → trả message để AI hỏi lại người dùng, KHÔNG tự chọn.
 */

export type ResolveResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type ResolvedRoom = {
  id: string;
  roomCode: string;
  propertyId: string;
  propertyName: string;
  status: string;
};

/**
 * So khớp tên không phân biệt hoa/thường và dấu (NFD bỏ dấu, đ -> d).
 * Dùng nội bộ khi phân giải; KHÔNG gửi số điện thoại/email đầy đủ cho Gemini.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Che số SĐT: chỉ giữ 3 chữ số cuối (ví dụ •••456). */
function maskPhone(phone: string | null): string {
  if (!phone) return 'chưa có SĐT';
  const tail = phone.replace(/\D/g, '').slice(-3);
  return `•••${tail}`;
}

export async function resolveRoom(
  db: TenantPrismaClient,
  roomCode: string,
  propertyName?: string
): Promise<ResolveResult<ResolvedRoom>> {
  const rooms = await db.room.findMany({
    where: {
      roomCode,
      ...(propertyName
        ? { property: { name: { equals: propertyName, mode: 'insensitive' } } }
        : {}),
    },
    select: {
      id: true,
      roomCode: true,
      propertyId: true,
      status: true,
      property: { select: { name: true } },
    },
    take: 5,
  });

  if (rooms.length === 0) {
    return {
      ok: false,
      message: propertyName
        ? `Không tìm thấy phòng có mã "${roomCode}" trong nhà trọ "${propertyName}". Bạn muốn nói phòng nào?`
        : `Không tìm thấy phòng có mã "${roomCode}". Bạn muốn nói phòng nào?`,
    };
  }
  if (rooms.length > 1) {
    const names = rooms.map((room) => room.property.name);
    return {
      ok: false,
      message: `Mã phòng "${roomCode}" xuất hiện ở nhiều nhà trọ: ${names.join(', ')}. Bạn muốn nói nhà trọ nào?`,
    };
  }

  const room = rooms[0];
  return {
    ok: true,
    value: {
      id: room.id,
      roomCode: room.roomCode,
      propertyId: room.propertyId,
      propertyName: room.property.name,
      status: room.status,
    },
  };
}

export async function resolvePropertyId(
  db: TenantPrismaClient,
  propertyName: string
): Promise<ResolveResult<string>> {
  const properties = await db.property.findMany({
    where: { name: { equals: propertyName, mode: 'insensitive' } },
    select: { id: true, name: true },
    take: 5,
  });

  if (properties.length === 0) {
    return { ok: false, message: `Không tìm thấy nhà trọ tên "${propertyName}".` };
  }
  if (properties.length > 1) {
    return {
      ok: false,
      message: `Có nhiều nhà trọ tên "${propertyName}": ${properties.map((p) => p.name).join(', ')}. Bạn muốn nói nhà trọ nào?`,
    };
  }
  return { ok: true, value: properties[0].id };
}

/** Hợp đồng ACTIVE của phòng — dùng để lập hóa đơn theo mã phòng. */
export async function resolveActiveContract(
  db: TenantPrismaClient,
  roomId: string
): Promise<ResolveResult<string>> {
  const contract = await db.contract.findFirst({
    where: { roomId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!contract) {
    return {
      ok: false,
      message: 'Phòng này chưa có hợp đồng hiệu lực nên chưa thể lập hóa đơn.',
    };
  }
  return { ok: true, value: contract.id };
}

/**
 * Phân giải người thuê: SĐT ưu tiên (khớp chính xác), tên phụ trợ
 * (khớp chính xác, không phân biệt hoa/thường và dấu).
 * Nhiều ứng viên → liệt kê họ tên + 3 chữ số SĐT cuối để AI hỏi lại.
 */
export async function resolveRenter(
  db: TenantPrismaClient,
  criteria: { renterPhone?: string; renterName?: string }
): Promise<ResolveResult<string>> {
  if (criteria.renterPhone) {
    const matches = await db.user.findMany({
      where: { role: UserRole.RENTER, phone: criteria.renterPhone },
      select: { id: true, fullName: true, phone: true },
      take: 5,
    });
    if (matches.length === 1) return { ok: true, value: matches[0].id };
    if (matches.length === 0) {
      return {
        ok: false,
        message: `Không tìm thấy người thuê có số điện thoại ${maskPhone(criteria.renterPhone)}.`,
      };
    }
    return { ok: false, message: 'Có nhiều người thuê trùng số điện thoại, bạn cần làm rõ thêm.' };
  }

  const target = normalizeText(criteria.renterName ?? '');
  const renters = await db.user.findMany({
    where: { role: UserRole.RENTER },
    select: { id: true, fullName: true, phone: true },
  });
  const matches = renters.filter((renter) => normalizeText(renter.fullName) === target);

  if (matches.length === 1) return { ok: true, value: matches[0].id };
  if (matches.length === 0) {
    return {
      ok: false,
      message: `Không tìm thấy người thuê tên "${criteria.renterName}".`,
    };
  }
  const list = matches
    .map((renter) => `${renter.fullName} (SĐT ${maskPhone(renter.phone)})`)
    .join('; ');
  return {
    ok: false,
    message: `Có nhiều người thuê trùng tên: ${list}. Bạn muốn nói ai?`,
  };
}

/** Dịch vụ ĐANG HOẠT ĐỘNG theo tên trong một nhà trọ (tên duy nhất theo nhà trọ). */
export async function resolveService(
  db: TenantPrismaClient,
  propertyId: string,
  serviceName: string
): Promise<ResolveResult<string>> {
  const services = await db.service.findMany({
    where: {
      propertyId,
      isActive: true,
      name: { equals: serviceName, mode: 'insensitive' },
    },
    select: { id: true, name: true },
    take: 5,
  });

  if (services.length === 0) {
    return {
      ok: false,
      message: `Không tìm thấy dịch vụ đang hoạt động tên "${serviceName}" của nhà trọ này.`,
    };
  }
  if (services.length > 1) {
    return {
      ok: false,
      message: `Có nhiều dịch vụ tên "${serviceName}", hãy dùng tên khác để làm rõ.`,
    };
  }
  return { ok: true, value: services[0].id };
}
