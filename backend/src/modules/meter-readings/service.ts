import { Prisma, ContractStatus } from '@prisma/client';
import { getTenantDb, TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import { getCurrentYearMonth } from '../../lib/timezone';
import {
  MeterReadingListQuery,
  MeterSheetQuery,
  CreateMeterReadingInput,
  UpdateMeterReadingInput,
} from './schema';

const readingSelect = {
  id: true,
  tenantId: true,
  roomId: true,
  billingMonth: true,
  electricityIndex: true,
  waterIndex: true,
  electricityUsage: true,
  waterUsage: true,
  createdAt: true,
  room: {
    select: {
      id: true,
      roomCode: true,
      propertyId: true,
      property: { select: { name: true } },
    },
  },
} satisfies Prisma.MeterReadingSelect;

type ReadingRow = Prisma.MeterReadingGetPayload<{ select: typeof readingSelect }>;

type Indexes = {
  electricityIndex: Prisma.Decimal;
  waterIndex: Prisma.Decimal;
};

/**
 * Kỳ 'YYYY-MM' -> ngày đầu tháng (UTC midnight, khớp kiểu @db.Date).
 */
function parseBillingMonth(value: string): Date {
  return new Date(`${value}-01T00:00:00.000Z`);
}

function dateOnlyToString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Bất thường: chỉ số mới nhỏ hơn chỉ số kỳ trước (giảm) — suy ra lúc đọc từ dữ liệu,
 * KHÔNG lưu cột riêng. Chỉ trả ở chi tiết và /sheet.
 */
function isAnomaly(previous: Indexes | null, current: Indexes): boolean {
  if (!previous) return false;
  return (
    previous.electricityIndex.gt(current.electricityIndex) ||
    previous.waterIndex.gt(current.waterIndex)
  );
}

function serializeReading(reading: ReadingRow) {
  const { room } = reading;
  return {
    id: reading.id,
    tenantId: reading.tenantId,
    roomId: reading.roomId,
    billingMonth: dateOnlyToString(reading.billingMonth),
    electricityIndex: reading.electricityIndex.toString(),
    waterIndex: reading.waterIndex.toString(),
    electricityUsage: reading.electricityUsage.toString(),
    waterUsage: reading.waterUsage.toString(),
    createdAt: reading.createdAt,
    room: {
      id: room.id,
      roomCode: room.roomCode,
      propertyId: room.propertyId,
      propertyName: room.property.name,
    },
  };
}

function assertNotFutureMonth(billingMonth: string): void {
  const { year, month } = getCurrentYearMonth();
  const [inputYear, inputMonth] = billingMonth.split('-').map(Number);
  if (inputYear * 12 + inputMonth > year * 12 + month) {
    throw ApiError.badRequest(
      'INVALID_BILLING_MONTH',
      'Không thể ghi chỉ số cho kỳ ở tương lai'
    );
  }
}

/**
 * Tính lượng tiêu thụ cho một loại chỉ số.
 * - Có mốc/kỳ trước và chỉ số mới >= mốc: usage = mới - mốc.
 * - Chỉ số mới < mốc: đã được xác nhận bất thường -> coi như thay đồng hồ, usage = chỉ số mới (đếm từ 0).
 * - Không có mốc (kỳ khởi tạo): usage = 0.
 * Server LUÔN tự tính, không bao giờ âm.
 */
function computeUsage(
  newIndex: Prisma.Decimal,
  previousIndex: Prisma.Decimal | undefined
): Prisma.Decimal {
  if (previousIndex === undefined) return new Prisma.Decimal(0);
  if (newIndex.lt(previousIndex)) return newIndex;
  return newIndex.minus(previousIndex);
}

/**
 * Kiểm tra chỉ số giảm: nếu có bất kỳ loại nào giảm mà chưa xác nhận -> 409 kèm mốc kỳ trước.
 */
function assertNotDecreased(
  newElectricity: Prisma.Decimal,
  newWater: Prisma.Decimal,
  previous: { electricityIndex: Prisma.Decimal; waterIndex: Prisma.Decimal } | undefined,
  confirmAnomaly: boolean
): void {
  if (!previous) return;
  const decreased =
    newElectricity.lt(previous.electricityIndex) || newWater.lt(previous.waterIndex);
  if (decreased && !confirmAnomaly) {
    throw ApiError.conflict(
      'METER_INDEX_DECREASED',
      'Chỉ số mới nhỏ hơn chỉ số kỳ trước. Gửi lại với confirmAnomaly=true nếu đã thay đồng hồ.',
      {
        previousElectricityIndex: previous.electricityIndex.toString(),
        previousWaterIndex: previous.waterIndex.toString(),
      }
    );
  }
}

function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function listMeterReadings(context: TenantContext, query: MeterReadingListQuery) {
  const db = getTenantDb(context);
  const where: Prisma.MeterReadingWhereInput = {};
  if (query.roomId) where.roomId = query.roomId;
  if (query.propertyId) where.room = { propertyId: query.propertyId };
  if (query.billingMonth) where.billingMonth = parseBillingMonth(query.billingMonth);

  const total = await db.meterReading.count({ where });
  const rows = await db.meterReading.findMany({
    where,
    select: readingSelect,
    orderBy: [{ billingMonth: 'desc' }, { createdAt: 'desc' }],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    data: rows.map(serializeReading),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function getMeterReading(context: TenantContext, readingId: string) {
  const db = getTenantDb(context);
  const reading = await db.meterReading.findUnique({
    where: { id: readingId },
    select: readingSelect,
  });
  if (!reading) {
    throw ApiError.notFound('METER_READING_NOT_FOUND', 'Không tìm thấy chỉ số điện nước');
  }

  const previous = await db.meterReading.findFirst({
    where: { roomId: reading.roomId, billingMonth: { lt: reading.billingMonth } },
    orderBy: { billingMonth: 'desc' },
    select: { electricityIndex: true, waterIndex: true },
  });

  return { ...serializeReading(reading), anomaly: isAnomaly(previous, reading) };
}

/**
 * UC16: ghi chỉ số. Phòng phải thuộc Tenant (404) và đang có hợp đồng ACTIVE (409).
 * Kỳ phải SAU kỳ gần nhất; usage do server tự tính.
 */
export async function createMeterReading(
  context: TenantContext,
  input: CreateMeterReadingInput
) {
  assertNotFutureMonth(input.billingMonth);
  const db = getTenantDb(context);
  const billingMonth = parseBillingMonth(input.billingMonth);

  try {
    return await db.tenantTransaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { id: input.roomId },
        select: { id: true },
      });
      if (!room) throw ApiError.notFound('ROOM_NOT_FOUND', 'Không tìm thấy phòng');

      const activeContract = await tx.contract.findFirst({
        where: { roomId: input.roomId, status: ContractStatus.ACTIVE },
        select: { id: true },
      });
      if (!activeContract) {
        throw ApiError.conflict(
          'NO_ACTIVE_CONTRACT',
          'Phòng không có hợp đồng đang hiệu lực, không thể ghi chỉ số'
        );
      }

      const latest = await tx.meterReading.findFirst({
        where: { roomId: input.roomId },
        orderBy: { billingMonth: 'desc' },
        select: { billingMonth: true, electricityIndex: true, waterIndex: true },
      });

      if (latest && billingMonth <= latest.billingMonth) {
        throw ApiError.conflict(
          'METER_PERIOD_CONFLICT',
          'Kỳ này đã tồn tại hoặc không nằm sau kỳ gần nhất của phòng'
        );
      }

      const hasBaseline =
        input.previousElectricityIndex !== undefined ||
        input.previousWaterIndex !== undefined;
      // Mốc chỉ hợp lệ cho kỳ khởi tạo (phòng chưa có kỳ nào).
      if (latest && hasBaseline) {
        throw ApiError.badRequest(
          'PREVIOUS_INDEX_NOT_ALLOWED',
          'Chỉ gửi chỉ số mốc cho kỳ đầu tiên khi phòng chưa có chỉ số nào'
        );
      }

      const newElectricity = new Prisma.Decimal(input.electricityIndex);
      const newWater = new Prisma.Decimal(input.waterIndex);

      // Kỳ trước = kỳ gần nhất (do kỳ mới bắt buộc sau kỳ gần nhất) hoặc mốc client gửi.
      const previous = latest
        ? { electricityIndex: latest.electricityIndex, waterIndex: latest.waterIndex }
        : {
            electricityIndex:
              input.previousElectricityIndex !== undefined
                ? new Prisma.Decimal(input.previousElectricityIndex)
                : undefined,
            waterIndex:
              input.previousWaterIndex !== undefined
                ? new Prisma.Decimal(input.previousWaterIndex)
                : undefined,
          };

      if (previous.electricityIndex !== undefined || previous.waterIndex !== undefined) {
        assertNotDecreased(
          newElectricity,
          newWater,
          {
            electricityIndex: previous.electricityIndex ?? newElectricity,
            waterIndex: previous.waterIndex ?? newWater,
          },
          input.confirmAnomaly
        );
      }

      const reading = await tx.meterReading.create({
        data: {
          tenantId: context.tenantId,
          roomId: input.roomId,
          billingMonth,
          electricityIndex: newElectricity,
          waterIndex: newWater,
          electricityUsage: computeUsage(newElectricity, previous.electricityIndex),
          waterUsage: computeUsage(newWater, previous.waterIndex),
        },
        select: readingSelect,
      });

      return serializeReading(reading);
    });
  } catch (err) {
    // uq_meter_room_month: chốt chặn race khi hai request ghi cùng kỳ.
    if (isUniqueViolation(err)) {
      throw ApiError.conflict(
        'METER_PERIOD_CONFLICT',
        'Kỳ này đã tồn tại hoặc không nằm sau kỳ gần nhất của phòng'
      );
    }
    throw err;
  }
}

/**
 * Chỉ sửa chỉ số của kỳ GẦN NHẤT và chỉ khi chưa có hóa đơn gắn. Tính lại usage.
 */
export async function updateMeterReading(
  context: TenantContext,
  readingId: string,
  input: UpdateMeterReadingInput
) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const reading = await tx.meterReading.findUnique({
      where: { id: readingId },
      select: {
        id: true,
        roomId: true,
        billingMonth: true,
        electricityIndex: true,
        waterIndex: true,
      },
    });
    if (!reading) {
      throw ApiError.notFound('METER_READING_NOT_FOUND', 'Không tìm thấy chỉ số điện nước');
    }

    // Khóa chỉ số: chỉ tính hóa đơn CHƯA HỦY (hủy rồi lập lại được — UC18).
    const invoice = await tx.invoice.findFirst({
      where: { meterReadingId: readingId, status: { not: 'CANCELLED' } },
      select: { id: true },
    });
    if (invoice) {
      throw ApiError.conflict(
        'METER_READING_LOCKED',
        'Chỉ số đã được dùng để lập hóa đơn, không thể sửa'
      );
    }

    const latest = await tx.meterReading.findFirst({
      where: { roomId: reading.roomId },
      orderBy: { billingMonth: 'desc' },
      select: { id: true },
    });
    if (latest && latest.id !== reading.id) {
      throw ApiError.conflict(
        'METER_READING_NOT_LATEST',
        'Chỉ được sửa chỉ số của kỳ gần nhất'
      );
    }

    const previous = await tx.meterReading.findFirst({
      where: { roomId: reading.roomId, billingMonth: { lt: reading.billingMonth } },
      orderBy: { billingMonth: 'desc' },
      select: { electricityIndex: true, waterIndex: true },
    });

    const newElectricity =
      input.electricityIndex !== undefined
        ? new Prisma.Decimal(input.electricityIndex)
        : reading.electricityIndex;
    const newWater =
      input.waterIndex !== undefined
        ? new Prisma.Decimal(input.waterIndex)
        : reading.waterIndex;

    assertNotDecreased(newElectricity, newWater, previous ?? undefined, input.confirmAnomaly);

    const updated = await tx.meterReading.update({
      where: { id: readingId },
      data: {
        electricityIndex: newElectricity,
        waterIndex: newWater,
        electricityUsage: computeUsage(newElectricity, previous?.electricityIndex),
        waterUsage: computeUsage(newWater, previous?.waterIndex),
      },
      select: readingSelect,
    });

    return serializeReading(updated);
  });
}

/**
 * Bảng nhập chỉ số cho một nhà trọ trong một kỳ: các phòng đang có hợp đồng ACTIVE,
 * kèm chỉ số kỳ trước, bản ghi của kỳ này (nếu có) và cờ locked (đã lập hóa đơn).
 */
export async function getMeterSheet(context: TenantContext, query: MeterSheetQuery) {
  const db = getTenantDb(context);
  const billingMonth = parseBillingMonth(query.billingMonth);

  const property = await db.property.findUnique({
    where: { id: query.propertyId },
    select: { id: true, name: true },
  });
  if (!property) {
    throw ApiError.notFound('PROPERTY_NOT_FOUND', 'Không tìm thấy nhà trọ');
  }

  const contracts = await db.contract.findMany({
    where: { status: ContractStatus.ACTIVE, room: { propertyId: query.propertyId } },
    select: {
      roomId: true,
      renter: { select: { id: true, fullName: true } },
      room: { select: { id: true, roomCode: true } },
    },
    orderBy: { room: { roomCode: 'asc' } },
  });

  const roomIds = contracts.map((contract) => contract.roomId);

  const readings = roomIds.length
    ? await db.meterReading.findMany({
        where: { roomId: { in: roomIds }, billingMonth: { lte: billingMonth } },
        select: {
          id: true,
          roomId: true,
          billingMonth: true,
          electricityIndex: true,
          waterIndex: true,
          electricityUsage: true,
          waterUsage: true,
          createdAt: true,
        },
        orderBy: { billingMonth: 'asc' },
      })
    : [];

  const currentIds = readings
    .filter((reading) => reading.billingMonth.getTime() === billingMonth.getTime())
    .map((reading) => reading.id);

  const invoices = currentIds.length
    ? await db.invoice.findMany({
        where: { meterReadingId: { in: currentIds }, status: { not: 'CANCELLED' } },
        select: { meterReadingId: true },
      })
    : [];
  const lockedIds = new Set(invoices.map((invoice) => invoice.meterReadingId));

  const data = contracts.map((contract) => {
    const roomReadings = readings.filter((reading) => reading.roomId === contract.roomId);
    const current =
      roomReadings.find((reading) => reading.billingMonth.getTime() === billingMonth.getTime()) ??
      null;
    const previous =
      roomReadings
        .filter((reading) => reading.billingMonth.getTime() < billingMonth.getTime())
        .pop() ?? null;

    return {
      roomId: contract.roomId,
      roomCode: contract.room.roomCode,
      renter: contract.renter,
      previous: previous
        ? {
            billingMonth: dateOnlyToString(previous.billingMonth),
            electricityIndex: previous.electricityIndex.toString(),
            waterIndex: previous.waterIndex.toString(),
          }
        : null,
      current: current
        ? {
            id: current.id,
            billingMonth: dateOnlyToString(current.billingMonth),
            electricityIndex: current.electricityIndex.toString(),
            waterIndex: current.waterIndex.toString(),
            electricityUsage: current.electricityUsage.toString(),
            waterUsage: current.waterUsage.toString(),
            createdAt: current.createdAt,
          }
        : null,
      anomaly: current ? isAnomaly(previous, current) : false,
      locked: current ? lockedIds.has(current.id) : false,
    };
  });

  return {
    propertyId: property.id,
    propertyName: property.name,
    billingMonth: query.billingMonth,
    data,
  };
}
