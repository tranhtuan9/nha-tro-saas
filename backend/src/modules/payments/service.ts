import { Prisma, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { getTenantDb, TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import {
  getPaymentGateway,
  PaymentGatewayError,
  type PaymentLinkInfo,
  type GatewayPaymentLinkStatus,
} from '../../lib/paymentGateway';
import { applyPaymentGatewayResult } from './webhook';
import { PaymentListQuery } from './schema';

const GATEWAY_UNAVAILABLE_MESSAGE = 'Cổng thanh toán tạm thời gián đoạn. Vui lòng thử lại sau.';
const MAX_ORDER_CODE_ATTEMPTS = 3;
const DEFAULT_LINK_TTL_MINUTES = 30;

function getPaymentLinkTtlMinutes(): number {
  const raw = Number(process.env.PAYMENT_LINK_TTL_MINUTES ?? String(DEFAULT_LINK_TTL_MINUTES));
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_LINK_TTL_MINUTES;
}

/**
 * orderCode: số nguyên dương an toàn (A1), sinh ngẫu nhiên trong khoảng rộng;
 * trùng unique payments_order_code_key (hiếm) thì sinh lại.
 */
function generateOrderCode(): number {
  return Math.floor(Math.random() * 9e14) + 1e12;
}

function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * description theo Q4: "HD <roomCode> <MM-YYYY>" không dấu, tối đa 25 ký tự,
 * không PII (chỉ mã phòng + kỳ hóa đơn).
 */
export function buildPaymentDescription(roomCode: string, billingMonth: Date): string {
  const period = `${String(billingMonth.getUTCMonth() + 1).padStart(2, '0')}-${billingMonth.getUTCFullYear()}`;
  const code =
    stripDiacritics(roomCode)
      .replace(/[^A-Za-z0-9 -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase() || 'X';
  // "HD " (3) + code + " " (1) + period (7) = 25 -> code tối đa 14 ký tự.
  const budget = 25 - 3 - 1 - period.length;
  return `HD ${code.slice(0, Math.max(budget, 1))} ${period}`;
}

/** returnUrl/cancelUrl do hệ thống sinh, kèm paymentId để FE gọi sync (mục 4). */
function buildResultUrl(paymentId: string): string {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/payments/result?paymentId=${paymentId}`;
}

function isLinkExpired(createdAt: Date, ttlMinutes: number): boolean {
  return createdAt.getTime() + ttlMinutes * 60 * 1000 < Date.now();
}

function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function uniqueViolationTargets(err: Prisma.PrismaClientKnownRequestError): string[] {
  const target = err.meta?.target;
  return Array.isArray(target) ? target.map(String) : [];
}

/** Lỗi cổng thanh toán (PaymentGatewayError) -> 502 PAYMENT_GATEWAY_ERROR (Q5). */
async function callGateway<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PaymentGatewayError) {
      // Chỉ log mô tả ngắn của gateway; không kèm khóa/chữ ký.
      console.error('[PaymentGateway]', err.message);
      throw new ApiError(502, 'PAYMENT_GATEWAY_ERROR', GATEWAY_UNAVAILABLE_MESSAGE);
    }
    throw err;
  }
}

const paymentSelect = {
  id: true,
  tenantId: true,
  invoiceId: true,
  orderCode: true,
  paymentLinkId: true,
  checkoutUrl: true,
  amount: true,
  status: true,
  paidAt: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

function serializePayment(payment: PaymentRow) {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    orderCode: payment.orderCode.toString(),
    paymentLinkId: payment.paymentLinkId,
    checkoutUrl: payment.checkoutUrl,
    amount: payment.amount.toString(),
    status: payment.status,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  };
}

function serializeLinkResult(payment: PaymentRow) {
  const expiresAt = new Date(payment.createdAt.getTime() + getPaymentLinkTtlMinutes() * 60 * 1000);
  return {
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    orderCode: payment.orderCode.toString(),
    checkoutUrl: payment.checkoutUrl,
    amount: payment.amount.toString(),
    status: payment.status,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Đã có PENDING khác chèn trước (P2002 uq_payment_active_invoice):
 * đã có checkout_url -> trả giao dịch hiện có; chưa có (request kia đang dở) -> 409.
 */
async function resolveConcurrentPending(db: ReturnType<typeof getTenantDb>, invoiceId: string) {
  const existing = await db.payment.findFirst({
    where: { invoiceId, status: PaymentStatus.PENDING },
    select: paymentSelect,
  });
  if (existing?.checkoutUrl) {
    return { payment: existing, created: false as const };
  }
  throw ApiError.conflict(
    'PAYMENT_IN_PROGRESS',
    'Giao dịch thanh toán đang được xử lý. Vui lòng thử lại sau ít phút.'
  );
}

/**
 * UC31: tạo link thanh toán payOS cho hóa đơn của Renter.
 * Thứ tự (mục 2 kế hoạch duyệt): chèn Payment PENDING TRƯỚC (giữ chỗ nhờ
 * uq_payment_active_invoice), RỒI mới gọi payOS; payOS lỗi -> Payment FAILED,
 * không để lại link mồ côi ở cổng thanh toán.
 */
export async function createPaymentLink(context: TenantContext, invoiceId: string) {
  const db = getTenantDb(context);
  const ttlMinutes = getPaymentLinkTtlMinutes();

  // Đọc hóa đơn + PENDING hiện có bằng app_user + RLS: hóa đơn khác Tenant -> 404.
  const snapshot = await db.tenantTransaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        tenantId: true,
        status: true,
        totalAmount: true,
        billingMonth: true,
        contract: { select: { room: { select: { roomCode: true } } } },
      },
    });
    if (!invoice) {
      throw ApiError.notFound('INVOICE_NOT_FOUND', 'Không tìm thấy hóa đơn');
    }
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw ApiError.conflict('INVOICE_NOT_PAYABLE', 'Hóa đơn không ở trạng thái có thể thanh toán');
    }
    const pending = await tx.payment.findFirst({
      where: { invoiceId, status: PaymentStatus.PENDING },
      select: paymentSelect,
    });
    return { invoice, pending };
  });

  if (snapshot.pending) {
    const pending = snapshot.pending;
    if (!isLinkExpired(pending.createdAt, ttlMinutes)) {
      if (pending.checkoutUrl) {
        // Trả lại link cũ (không tạo mới) — SDK không trả checkoutUrl khi GET nên phải đọc từ DB.
        return { payment: pending, created: false as const };
      }
      throw ApiError.conflict(
        'PAYMENT_IN_PROGRESS',
        'Giao dịch thanh toán đang được xử lý. Vui lòng thử lại sau ít phút.'
      );
    }
    // PENDING quá hạn: best-effort hủy link cũ ở payOS rồi đánh dấu CANCELLED, tạo link mới.
    try {
      await getPaymentGateway().cancelPaymentLink(
        Number(pending.orderCode),
        'Link thanh toán hết hạn'
      );
    } catch (err) {
      console.error(
        '[PaymentCancelExpired]',
        err instanceof Error ? err.message : 'unknown'
      );
    }
    await db.payment.update({
      where: { id: pending.id },
      data: { status: PaymentStatus.CANCELLED },
    });
  }

  const invoice = snapshot.invoice;
  const amount = Number(invoice.totalAmount);
  const description = buildPaymentDescription(
    invoice.contract.room.roomCode,
    invoice.billingMonth
  );
  const expiredAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  for (let attempt = 0; attempt < MAX_ORDER_CODE_ATTEMPTS; attempt++) {
    const orderCode = generateOrderCode();
    let payment: PaymentRow;
    try {
      payment = await db.payment.create({
        data: {
          tenantId: context.tenantId,
          invoiceId,
          orderCode,
          amount,
          status: PaymentStatus.PENDING,
        },
        select: paymentSelect,
      });
    } catch (err) {
      if (isUniqueViolation(err) && uniqueViolationTargets(err).includes('order_code')) {
        continue;
      }
      if (isUniqueViolation(err)) {
        // Request đồng thời đã chèn PENDING trước mình (uq_payment_active_invoice).
        return resolveConcurrentPending(db, invoiceId);
      }
      throw err;
    }

    let link;
    try {
      link = await callGateway(() =>
        getPaymentGateway().createPaymentLink({
          orderCode,
          amount,
          description,
          returnUrl: buildResultUrl(payment.id),
          cancelUrl: buildResultUrl(payment.id),
          expiredAt,
        })
      );
    } catch (err) {
      // payOS lỗi -> Payment FAILED; chưa có link nào ở cổng thanh toán.
      await db.payment
        .update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } })
        .catch(() => {});
      throw err;
    }

    try {
      const updated = await db.payment.update({
        where: { id: payment.id },
        data: { paymentLinkId: link.paymentLinkId, checkoutUrl: link.checkoutUrl },
        select: paymentSelect,
      });
      return { payment: updated, created: true as const };
    } catch (err) {
      // Không lưu được checkout_url -> hủy link vừa tạo ở payOS, không bỏ mồ côi.
      try {
        await getPaymentGateway().cancelPaymentLink(orderCode, 'Không lưu được thông tin thanh toán');
      } catch (cancelErr) {
        console.error(
          '[PaymentCancelOrphan]',
          cancelErr instanceof Error ? cancelErr.message : 'unknown'
        );
      }
      throw err;
    }
  }

  return resolveConcurrentPending(db, invoiceId);
}

/** UC31: hủy link đang chờ (chủ yếu qua cancel; webhook hủy/thất bại không phải luồng chính). */
export async function cancelPayment(context: TenantContext, paymentId: string) {
  const db = getTenantDb(context);
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: paymentSelect,
  });
  if (!payment) {
    throw ApiError.notFound('PAYMENT_NOT_FOUND', 'Không tìm thấy giao dịch thanh toán');
  }
  if (payment.status !== PaymentStatus.PENDING) {
    throw ApiError.conflict('PAYMENT_NOT_PENDING', 'Chỉ hủy được giao dịch đang chờ thanh toán');
  }

  await callGateway(() =>
    getPaymentGateway().cancelPaymentLink(Number(payment.orderCode), 'Người dùng hủy giao dịch')
  );

  const updated = await db.payment.update({
    where: { id: payment.id },
    data: { status: PaymentStatus.CANCELLED },
    select: paymentSelect,
  });
  return serializePayment(updated);
}

function mapGatewayStatus(status: GatewayPaymentLinkStatus): 'PAID' | 'CANCELLED' | 'FAILED' | 'NO_CHANGE' {
  if (status === 'PAID') return 'PAID';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'CANCELLED';
  if (status === 'FAILED') return 'FAILED';
  return 'NO_CHANGE';
}

/**
 * UC31: đồng bộ trạng thái từ payOS sau khi Renter quay về returnUrl/cancelUrl.
 * - B1: đọc Payment bằng kết nối THƯỜNG (app_user + RLS) — không thấy -> 404.
 * - B2: lấy trạng thái từ payOS (không tin tham số trên URL hay client).
 * - B3: xử lý dùng chung với prismaSystem (xem webhook.ts, applyPaymentGatewayResult).
 */
export async function syncPayment(context: TenantContext, paymentId: string) {
  const db = getTenantDb(context);

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: paymentSelect,
  });
  if (!payment) {
    throw ApiError.notFound('PAYMENT_NOT_FOUND', 'Không tìm thấy giao dịch thanh toán');
  }

  const info: PaymentLinkInfo = await callGateway(() =>
    getPaymentGateway().getPaymentLink(Number(payment.orderCode))
  );

  // Luật 13: hành động của Renter (sync) dẫn đến ghi Payment/Invoice và tạo Notification
  // cho Landlord/Renter — dùng prismaSystem (app_system, BYPASSRLS, Luật 3), luôn lấy
  // tenantId từ dòng Payment đã đọc qua RLS ở trên; KHÔNG nhận từ client và KHÔNG
  // nới lỏng policy RLS để Renter tự ghi. Dữ liệu so sánh lấy từ payOS, không từ client.
  await applyPaymentGatewayResult({
    orderCode: payment.orderCode,
    outcome: mapGatewayStatus(info.status),
    paidAmount: info.status === 'PAID' ? info.amountPaid : null,
  });

  const fresh = await db.payment.findUnique({
    where: { id: paymentId },
    select: paymentSelect,
  });
  return serializePayment((fresh ?? payment) as PaymentRow);
}

/** UC32: lịch sử thanh toán (Renter chỉ thấy của mình nhờ RLS renter_restrictive_policy). */
export async function listPayments(context: TenantContext, query: PaymentListQuery) {
  const db = getTenantDb(context);
  const where: Prisma.PaymentWhereInput = {};
  if (query.invoiceId) where.invoiceId = query.invoiceId;
  if (query.status) where.status = query.status;

  const total = await db.payment.count({ where });
  const rows = await db.payment.findMany({
    where,
    select: paymentSelect,
    orderBy: [{ createdAt: 'desc' }],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    data: rows.map(serializePayment),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function getPayment(context: TenantContext, paymentId: string) {
  const db = getTenantDb(context);
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: paymentSelect,
  });
  if (!payment) {
    throw ApiError.notFound('PAYMENT_NOT_FOUND', 'Không tìm thấy giao dịch thanh toán');
  }
  return serializePayment(payment);
}

/** Kết quả trả về cho client khi tạo link (201) hoặc lấy lại PENDING còn hạn (200). */
export function toLinkResultResponse(payment: PaymentRow) {
  return serializeLinkResult(payment);
}
