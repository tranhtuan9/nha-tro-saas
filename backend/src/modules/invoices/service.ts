import { Prisma, ContractStatus, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { getTenantDb, TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import { getPaymentGateway, PaymentGatewayError } from '../../lib/paymentGateway';
import { getCurrentYearMonth, getTodayDateOnly } from '../../lib/timezone';
import {
  CreateInvoiceInput,
  InvoiceListQuery,
  SummaryQuery,
} from './schema';

// decimal(12,0): tối đa 12 chữ số (999.999.999.999 VND). Vượt -> 400 AMOUNT_OUT_OF_RANGE.
const MAX_AMOUNT = new Prisma.Decimal('999999999999');

function getInvoiceDueDays(): number {
  const raw = Number(process.env.INVOICE_DUE_DAYS ?? '10');
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 10;
}

function parseBillingMonth(value: string): Date {
  return new Date(`${value}-01T00:00:00.000Z`);
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateOnlyToString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Làm tròn half-up về số nguyên VND. Tính TỪNG thành phần rồi mới cộng;
 * không dùng số thực ở bất kỳ bước nào.
 */
function roundVnd(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

function assertAmountInRange(value: Prisma.Decimal): void {
  if (value.lt(0) || value.gt(MAX_AMOUNT)) {
    throw ApiError.badRequest(
      'AMOUNT_OUT_OF_RANGE',
      'Số tiền vượt quá giới hạn cho phép (tối đa 999.999.999.999 VND)'
    );
  }
}

/**
 * Trạng thái hiệu dụng khi đọc: stored UNPAID + quá hạn theo APP_TIMEZONE -> OVERDUE.
 * DB KHÔNG BAO GIỜ lưu OVERDUE; enum chỉ giữ để không drop.
 */
function getEffectiveStatus(
  status: InvoiceStatus,
  dueDate: Date,
  today: Date
): InvoiceStatus {
  if (status === InvoiceStatus.UNPAID && dueDate.getTime() < today.getTime()) {
    return InvoiceStatus.OVERDUE;
  }
  return status;
}

function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Bước ghi dòng dịch vụ tách riêng (qua object) để test có thể tiêm lỗi bằng vi.spyOn
 * và chứng minh Invoice + LineItem rollback cùng nhau (không giữ Invoice mồ côi).
 */
export const invoiceLineItemWriter = {
  createMany(
    tx: Prisma.TransactionClient,
    data: Prisma.InvoiceLineItemCreateManyInput[]
  ) {
    return tx.invoiceLineItem.createMany({ data });
  },
};

const invoiceListSelect = {
  id: true,
  tenantId: true,
  contractId: true,
  meterReadingId: true,
  billingMonth: true,
  electricityUnitPrice: true,
  waterUnitPrice: true,
  rentAmount: true,
  electricityAmount: true,
  waterAmount: true,
  serviceAmount: true,
  totalAmount: true,
  status: true,
  issueDate: true,
  dueDate: true,
  paidAt: true,
  createdAt: true,
  contract: {
    select: {
      room: { select: { id: true, roomCode: true, propertyId: true, property: { select: { name: true } } } },
      renter: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.InvoiceSelect;

const invoiceDetailSelect = {
  ...invoiceListSelect,
  lineItems: {
    select: {
      id: true,
      serviceId: true,
      serviceName: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      amount: true,
    },
  },
} satisfies Prisma.InvoiceSelect;

type InvoiceListRow = Prisma.InvoiceGetPayload<{ select: typeof invoiceListSelect }>;
type InvoiceDetailRow = Prisma.InvoiceGetPayload<{ select: typeof invoiceDetailSelect }>;

function serializeInvoice(
  invoice: InvoiceListRow,
  today: Date
) {
  const { contract, ...rest } = invoice;
  return {
    ...rest,
    billingMonth: dateOnlyToString(rest.billingMonth).slice(0, 7),
    electricityUnitPrice: rest.electricityUnitPrice.toString(),
    waterUnitPrice: rest.waterUnitPrice.toString(),
    rentAmount: rest.rentAmount.toString(),
    electricityAmount: rest.electricityAmount.toString(),
    waterAmount: rest.waterAmount.toString(),
    serviceAmount: rest.serviceAmount.toString(),
    totalAmount: rest.totalAmount.toString(),
    status: getEffectiveStatus(rest.status, rest.dueDate, today),
    issueDate: dateOnlyToString(rest.issueDate),
    dueDate: dateOnlyToString(rest.dueDate),
    room: {
      id: contract.room.id,
      roomCode: contract.room.roomCode,
      propertyId: contract.room.propertyId,
      propertyName: contract.room.property.name,
    },
    renter: contract.renter,
  };
}

function serializeInvoiceDetail(invoice: InvoiceDetailRow, today: Date) {
  const { lineItems, ...base } = invoice;
  return {
    ...serializeInvoice(base, today),
    lineItems: lineItems.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      quantity: item.quantity.toString(),
      amount: item.amount.toString(),
    })),
  };
}

function buildListWhere(query: InvoiceListQuery, today: Date): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {};
  const contractFilter: Prisma.ContractWhereInput = {};
  if (query.roomId) contractFilter.roomId = query.roomId;
  if (query.propertyId) contractFilter.room = { propertyId: query.propertyId };
  if (Object.keys(contractFilter).length > 0) where.contract = contractFilter;
  if (query.contractId) where.contractId = query.contractId;
  if (query.billingMonth) where.billingMonth = parseBillingMonth(query.billingMonth);

  // Ánh xạ trạng thái hiệu dụng (mục 0.4): UNPAID không gồm quá hạn.
  if (query.status === 'UNPAID') {
    where.AND = [{ status: InvoiceStatus.UNPAID }, { dueDate: { gte: today } }];
  } else if (query.status === 'OVERDUE') {
    where.AND = [{ status: InvoiceStatus.UNPAID }, { dueDate: { lt: today } }];
  } else if (query.status) {
    where.status = query.status;
  }
  return where;
}

type LineItemDraft = {
  serviceId: string;
  serviceName: string;
  unit: string;
  unitPrice: Prisma.Decimal;
  quantity: Prisma.Decimal;
  amount: Prisma.Decimal;
};

type BuiltInvoice = {
  contract: {
    id: string;
    roomId: string;
    renterId: string;
    monthlyRent: Prisma.Decimal;
    room: {
      id: string;
      roomCode: string;
      propertyId: string;
      property: { electricityUnitPrice: Prisma.Decimal; waterUnitPrice: Prisma.Decimal };
    };
    renter: { id: string; fullName: string };
  };
  meterReadingId: string;
  billingMonth: Date;
  electricityUnitPrice: Prisma.Decimal;
  waterUnitPrice: Prisma.Decimal;
  rentAmount: Prisma.Decimal;
  electricityAmount: Prisma.Decimal;
  waterAmount: Prisma.Decimal;
  serviceAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  lineItems: LineItemDraft[];
  issueDate: Date;
  dueDate: Date;
};

/**
 * Validate + tính toán hóa đơn (không phân biệt preview/create).
 * Mọi tích và tổng đều qua Prisma.Decimal, làm tròn half-up TỪNG thành phần.
 * Gọi bên trong transaction (tx) để preview và create không bao giờ lệch luật.
 */
async function buildInvoiceData(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  input: CreateInvoiceInput,
  today: Date
): Promise<BuiltInvoice> {
  // Kỳ tương lai (so theo APP_TIMEZONE).
  const { year, month } = getCurrentYearMonth();
  const [inputYear, inputMonth] = input.billingMonth.split('-').map(Number);
  if (inputYear * 12 + inputMonth > year * 12 + month) {
    throw ApiError.badRequest('INVALID_BILLING_MONTH', 'Không thể lập hóa đơn cho kỳ tương lai', {
      reason: 'FUTURE',
    });
  }

  const contract = await tx.contract.findUnique({
    where: { id: input.contractId },
    select: {
      id: true,
      roomId: true,
      renterId: true,
      monthlyRent: true,
      startDate: true,
      status: true,
      room: {
        select: {
          id: true,
          roomCode: true,
          propertyId: true,
          property: { select: { electricityUnitPrice: true, waterUnitPrice: true } },
        },
      },
      renter: { select: { id: true, fullName: true } },
    },
  });
  if (!contract) {
    throw ApiError.notFound('CONTRACT_NOT_FOUND', 'Không tìm thấy hợp đồng');
  }
  if (contract.status !== ContractStatus.ACTIVE) {
    throw ApiError.conflict(
      'CONTRACT_NOT_ACTIVE',
      'Chỉ lập hóa đơn cho hợp đồng đang hiệu lực'
    );
  }

  // Kỳ trước tháng bắt đầu hợp đồng (G2: cùng mã, khác reason).
  const startYear = contract.startDate.getUTCFullYear();
  const startMonth = contract.startDate.getUTCMonth() + 1;
  if (inputYear * 12 + inputMonth < startYear * 12 + startMonth) {
    throw ApiError.badRequest(
      'INVALID_BILLING_MONTH',
      'Kỳ hóa đơn trước tháng bắt đầu hợp đồng',
      { reason: 'BEFORE_CONTRACT_START' }
    );
  }

  const billingMonth = parseBillingMonth(input.billingMonth);
  const meterReading = await tx.meterReading.findFirst({
    where: { roomId: contract.roomId, billingMonth },
    select: { id: true, electricityUsage: true, waterUsage: true },
  });
  if (!meterReading) {
    throw ApiError.conflict(
      'METER_READING_REQUIRED',
      'Phòng chưa có chỉ số điện nước cho kỳ này. Hãy ghi chỉ số (UC16) trước khi lập hóa đơn'
    );
  }
  const lockedByInvoice = await tx.invoice.findFirst({
    where: { meterReadingId: meterReading.id, status: { not: InvoiceStatus.CANCELLED } },
    select: { id: true },
  });
  if (lockedByInvoice) {
    throw ApiError.conflict(
      'METER_READING_LOCKED',
      'Chỉ số kỳ này đã được dùng lập hóa đơn'
    );
  }

  // Snapshot đơn giá nhà trọ tại thời điểm lập.
  const electricityUnitPrice = contract.room.property.electricityUnitPrice;
  const waterUnitPrice = contract.room.property.waterUnitPrice;
  const electricityAmount = roundVnd(meterReading.electricityUsage.times(electricityUnitPrice));
  const waterAmount = roundVnd(meterReading.waterUsage.times(waterUnitPrice));
  const rentAmount = contract.monthlyRent;

  // Dịch vụ: chỉ từ danh mục đang hoạt động của nhà trọ của phòng.
  const lineItems: LineItemDraft[] = [];
  if (input.services.length > 0) {
    const serviceIds = input.services.map((item) => item.serviceId);
    const services = await tx.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, unit: true, unitPrice: true, isActive: true, propertyId: true },
    });
    const serviceById = new Map(services.map((service) => [service.id, service]));

    for (const item of input.services) {
      const service = serviceById.get(item.serviceId);
      if (
        !service ||
        !service.isActive ||
        service.propertyId !== contract.room.propertyId
      ) {
        throw ApiError.badRequest(
          'SERVICE_NOT_APPLICABLE',
          'Dịch vụ không tồn tại, đã ngừng hoặc không thuộc nhà trọ của phòng'
        );
      }
      const quantity = new Prisma.Decimal(item.quantity);
      const amount = roundVnd(service.unitPrice.times(quantity));
      assertAmountInRange(amount);
      lineItems.push({
        serviceId: service.id,
        serviceName: service.name,
        unit: service.unit,
        unitPrice: service.unitPrice,
        quantity,
        amount,
      });
    }
  }
  const serviceAmount = lineItems.reduce(
    (sum, item) => sum.plus(item.amount),
    new Prisma.Decimal(0)
  );
  const totalAmount = rentAmount.plus(electricityAmount).plus(waterAmount).plus(serviceAmount);

  assertAmountInRange(electricityAmount);
  assertAmountInRange(waterAmount);
  assertAmountInRange(serviceAmount);
  assertAmountInRange(totalAmount);

  // Ngày: issueDate = hôm nay (APP_TIMEZONE); dueDate client gửi (>= issueDate) hoặc hôm nay + INVOICE_DUE_DAYS.
  const issueDate = today;
  const dueDate = input.dueDate ? toDateOnly(input.dueDate) : addDays(today, getInvoiceDueDays());
  if (dueDate.getTime() < issueDate.getTime()) {
    throw ApiError.badRequest(
      'INVALID_DUE_DATE',
      'Ngày đáo hạn không được trước ngày lập hóa đơn'
    );
  }

  return {
    contract,
    meterReadingId: meterReading.id,
    billingMonth,
    electricityUnitPrice,
    waterUnitPrice,
    rentAmount,
    electricityAmount,
    waterAmount,
    serviceAmount,
    totalAmount,
    lineItems,
    issueDate,
    dueDate,
  };
}

function serializeBuiltInvoice(built: BuiltInvoice) {
  return {
    contractId: built.contract.id,
    meterReadingId: built.meterReadingId,
    billingMonth: dateOnlyToString(built.billingMonth).slice(0, 7),
    effectiveStatus: InvoiceStatus.UNPAID,
    electricityUnitPrice: built.electricityUnitPrice.toString(),
    waterUnitPrice: built.waterUnitPrice.toString(),
    rentAmount: built.rentAmount.toString(),
    electricityAmount: built.electricityAmount.toString(),
    waterAmount: built.waterAmount.toString(),
    serviceAmount: built.serviceAmount.toString(),
    totalAmount: built.totalAmount.toString(),
    issueDate: dateOnlyToString(built.issueDate),
    dueDate: dateOnlyToString(built.dueDate),
    room: {
      id: built.contract.room.id,
      roomCode: built.contract.room.roomCode,
      propertyId: built.contract.room.propertyId,
    },
    renter: built.contract.renter,
    lineItems: built.lineItems.map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      unit: item.unit,
      unitPrice: item.unitPrice.toString(),
      quantity: item.quantity.toString(),
      amount: item.amount.toString(),
    })),
  };
}

/**
 * UC18 (xem trước): validate + tính toán như create nhưng KHÔNG ghi gì.
 * Dùng chung buildInvoiceData với createInvoice để hai đường không lệch luật.
 */
export async function previewInvoice(context: TenantContext, input: CreateInvoiceInput) {
  const db = getTenantDb(context);
  const today = getTodayDateOnly();
  const built = await db.tenantTransaction((tx) => buildInvoiceData(tx, context, input, today));
  return serializeBuiltInvoice(built);
}

/**
 * UC18: lập hóa đơn. Invoice + InvoiceLineItem trong MỘT transaction;
 * partial unique index chặn race (hóa đơn chưa hủy mỗi hợp đồng/mỗi kỳ).
 * Notification NEW_INVOICE cho Renter SAU commit; lỗi notification chỉ log.
 */
export async function createInvoice(context: TenantContext, input: CreateInvoiceInput) {
  const db = getTenantDb(context);
  const today = getTodayDateOnly();

  let result: ReturnType<typeof serializeInvoiceDetail>;

  // Holder object: gán bên trong closure nên không dùng `let | null` (TS narrowing sai).
  const notification: {
    current: {
      invoiceId: string;
      renterId: string;
      roomCode: string;
      billingMonth: string;
      totalAmount: string;
      dueDate: string;
    } | null;
  } = { current: null };

  try {
    result = await db.tenantTransaction(async (tx) => {
      const built = await buildInvoiceData(tx, context, input, today);

      const invoice = await tx.invoice.create({
        data: {
          tenantId: context.tenantId,
          contractId: built.contract.id,
          meterReadingId: built.meterReadingId,
          billingMonth: built.billingMonth,
          electricityUnitPrice: built.electricityUnitPrice,
          waterUnitPrice: built.waterUnitPrice,
          rentAmount: built.rentAmount,
          electricityAmount: built.electricityAmount,
          waterAmount: built.waterAmount,
          serviceAmount: built.serviceAmount,
          totalAmount: built.totalAmount,
          status: InvoiceStatus.UNPAID,
          issueDate: built.issueDate,
          dueDate: built.dueDate,
        },
      });

      if (built.lineItems.length > 0) {
        await invoiceLineItemWriter.createMany(
          tx,
          built.lineItems.map((item) => ({
            tenantId: context.tenantId,
            invoiceId: invoice.id,
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            unit: item.unit,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            amount: item.amount,
          }))
        );
      }

      notification.current = {
        invoiceId: invoice.id,
        renterId: built.contract.renterId,
        roomCode: built.contract.room.roomCode,
        billingMonth: dateOnlyToString(built.billingMonth).slice(0, 7),
        totalAmount: built.totalAmount.toString(),
        dueDate: dateOnlyToString(built.dueDate),
      };

      const created = await tx.invoice.findUnique({
        where: { id: invoice.id },
        select: invoiceDetailSelect,
      });
      return serializeInvoiceDetail(created as InvoiceDetailRow, today);
    });
  } catch (err) {
    // uq_invoice_active_contract_month / uq_invoice_active_meter_reading: race khi lập cùng kỳ.
    if (isUniqueViolation(err)) {
      throw ApiError.conflict(
        'INVOICE_ALREADY_EXISTS',
        'Kỳ này đã được lập hóa đơn cho hợp đồng'
      );
    }
    throw err;
  }

  // Notification NEW_INVOICE cho Renter SAU commit; lỗi chỉ log, không làm hỏng hóa đơn.
  // Landlord ghi trong Tenant của mình: app_user + tenant_isolation_policy là đủ (không cần prismaSystem).
  const payload = notification.current;
  if (payload) {
    try {
      await db.notification.create({
        data: {
          tenantId: context.tenantId,
          userId: payload.renterId,
          type: 'NEW_INVOICE',
          title: 'Hóa đơn mới',
          content: `Phòng ${payload.roomCode}, kỳ ${payload.billingMonth}: tổng ${payload.totalAmount} VND, hạn thanh toán ${payload.dueDate}.`,
          entityId: payload.invoiceId,
        },
      });
    } catch (err) {
      console.error('[InvoiceNotification]', err);
    }
  }

  return result;
}

/**
 * UC19: hủy hóa đơn. Chỉ hóa đơn chưa thanh toán; PAID -> 409; đã hủy -> idempotent.
 * Hủy giải phóng chỉ số và cho phép lập lại trong cùng kỳ.
 * Hóa đơn đang có link thanh toán PENDING: hủy link ở payOS trước; cổng thanh toán
 * gián đoạn -> 409 INVOICE_HAS_PENDING_PAYMENT (không hủy khi link còn sống bên payOS).
 */
export async function cancelInvoice(context: TenantContext, invoiceId: string) {
  const db = getTenantDb(context);
  const today = getTodayDateOnly();

  // Đọc Payment PENDING bằng app_user + RLS (không thấy nếu hóa đơn khác Tenant).
  const pending = await db.payment.findFirst({
    where: { invoiceId, status: PaymentStatus.PENDING },
    select: { id: true, orderCode: true },
  });
  if (pending) {
    try {
      await getPaymentGateway().cancelPaymentLink(
        Number(pending.orderCode),
        'Hóa đơn bị hủy bởi chủ nhà'
      );
    } catch (err) {
      if (err instanceof PaymentGatewayError) {
        console.error('[InvoiceCancelPendingPayment]', err.message);
        throw ApiError.conflict(
          'INVOICE_HAS_PENDING_PAYMENT',
          'Hóa đơn đang có giao dịch thanh toán chờ xử lý. Vui lòng thử lại sau ít phút.'
        );
      }
      throw err;
    }
    // Ghi ngoài transaction nghiệp vụ (không kéo dài transaction khi gọi cổng thanh toán).
    await db.payment.update({
      where: { id: pending.id },
      data: { status: PaymentStatus.CANCELLED },
    });
  }

  return db.tenantTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: invoiceListSelect,
    });
    if (!invoice) {
      throw ApiError.notFound('INVOICE_NOT_FOUND', 'Không tìm thấy hóa đơn');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw ApiError.conflict(
        'INVOICE_ALREADY_PAID',
        'Hóa đơn đã thanh toán, không thể hủy'
      );
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      return serializeInvoice(invoice, today);
    }

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.CANCELLED },
      select: invoiceListSelect,
    });
    return serializeInvoice(updated, today);
  });
}

export async function listInvoices(context: TenantContext, query: InvoiceListQuery) {
  const db = getTenantDb(context);
  const today = getTodayDateOnly();
  const where = buildListWhere(query, today);

  const total = await db.invoice.count({ where });
  const rows = await db.invoice.findMany({
    where,
    select: invoiceListSelect,
    orderBy: [{ billingMonth: 'desc' }, { createdAt: 'desc' }],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    data: rows.map((row) => serializeInvoice(row, today)),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

/**
 * UC30: Renter xem hóa đơn của mình (RLS renter_restrictive_policy tự lọc).
 */
export async function getInvoice(context: TenantContext, invoiceId: string) {
  const db = getTenantDb(context);
  const today = getTodayDateOnly();

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: invoiceDetailSelect,
  });
  if (!invoice) {
    throw ApiError.notFound('INVOICE_NOT_FOUND', 'Không tìm thấy hóa đơn');
  }
  return serializeInvoiceDetail(invoice, today);
}

/**
 * Nhóm "chưa thanh toán" (outstanding = hiệu dụng UNPAID + OVERDUE),
 * sắp xếp theo hạn thanh toán. Dùng chung cho AI (getUnpaidInvoices) và Dashboard.
 */
export async function getUnpaidInvoices(
  context: TenantContext,
  options: { billingMonth?: string } = {}
) {
  const db = getTenantDb(context);
  const today = getTodayDateOnly();

  const rows = await db.invoice.findMany({
    where: {
      status: InvoiceStatus.UNPAID,
      ...(options.billingMonth ? { billingMonth: parseBillingMonth(options.billingMonth) } : {}),
    },
    select: invoiceListSelect,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });

  return rows.map((row) => serializeInvoice(row, today));
}

/**
 * UC19: doanh thu và số liệu theo kỳ (month tùy chọn; không truyền = toàn bộ các kỳ).
 * Đủ "tổng + số lượng" cho issued/paid/unpaid/overdue + cancelledCount + outstanding.
 */
export async function getInvoiceSummary(context: TenantContext, query: SummaryQuery) {
  const db = getTenantDb(context);
  const today = getTodayDateOnly();
  const base: Prisma.InvoiceWhereInput = query.month
    ? { billingMonth: parseBillingMonth(query.month) }
    : {};

  const countAndSum = async (where: Prisma.InvoiceWhereInput) => {
    const result = await db.invoice.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    return {
      count: result._count._all,
      total: (result._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
    };
  };

  const issued = await countAndSum({ ...base, status: { not: InvoiceStatus.CANCELLED } });
  const paid = await countAndSum({ ...base, status: InvoiceStatus.PAID });
  const unpaid = await countAndSum({
    ...base,
    AND: [{ status: InvoiceStatus.UNPAID }, { dueDate: { gte: today } }],
  });
  const overdue = await countAndSum({
    ...base,
    AND: [{ status: InvoiceStatus.UNPAID }, { dueDate: { lt: today } }],
  });
  const cancelledCount = await db.invoice.count({
    where: { ...base, status: InvoiceStatus.CANCELLED },
  });

  const outstandingCount = unpaid.count + overdue.count;
  const outstandingTotal = new Prisma.Decimal(unpaid.total)
    .plus(new Prisma.Decimal(overdue.total))
    .toString();

  return {
    month: query.month ?? null,
    issuedCount: issued.count,
    issuedTotal: issued.total,
    paidCount: paid.count,
    paidTotal: paid.total,
    paidRevenue: paid.total,
    unpaidCount: unpaid.count,
    unpaidTotal: unpaid.total,
    overdueCount: overdue.count,
    overdueTotal: overdue.total,
    cancelledCount,
    outstandingCount,
    outstandingTotal,
  };
}
