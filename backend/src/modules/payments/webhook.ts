import { Request, Response, NextFunction } from 'express';
import { InvoiceStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { prismaSystem } from '../../lib/db';
import { asyncHandler } from '../../lib/asyncHandler';
import { getPaymentGateway, PaymentGatewayError, type PayosWebhookData } from '../../lib/paymentGateway';

/**
 * Xử lý kết quả thanh toán dùng chung cho Webhook payOS và sync (UC31).
 * - Idempotent: Payment đã PAID là no-op; webhook lặp lại/đồng thời không đổi gì.
 * - Webhook hợp lệ báo ĐÃ TRẢ TIỀN: Payment PENDING/CANCELLED/FAILED đều chuyển PAID
 *   (tiền đã thực sự vào tài khoản); Invoice chỉ đổi khi đang UNPAID (kể cả OVERDUE).
 * - Webhook báo hủy/thất bại (success=false): Payment PENDING -> FAILED — giữ để xử lý
 *   nhưng KHÔNG phải luồng chính; hủy chủ động qua POST /:id/cancel và sync.
 */

export type PaymentApplyOutcome = 'PAID' | 'CANCELLED' | 'FAILED' | 'NO_CHANGE';

type NotificationDraft = {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  entityId: string;
};

const paymentProcessSelect = {
  id: true,
  tenantId: true,
  invoiceId: true,
  orderCode: true,
  amount: true,
  status: true,
  invoice: {
    select: {
      id: true,
      status: true,
      billingMonth: true,
      contract: { select: { renterId: true, room: { select: { roomCode: true } } } },
    },
  },
} satisfies Prisma.PaymentSelect;

type PaymentProcessRow = Prisma.PaymentGetPayload<{ select: typeof paymentProcessSelect }>;

function formatPeriod(billingMonth: Date): string {
  return `${String(billingMonth.getUTCMonth() + 1).padStart(2, '0')}-${billingMonth.getUTCFullYear()}`;
}

async function findLandlordUserId(tenantId: string): Promise<string | null> {
  const landlord = await prismaSystem.user.findFirst({
    where: { tenantId, role: UserRole.LANDLORD },
    select: { id: true },
  });
  return landlord?.id ?? null;
}

/**
 * Ghi Notification SAU khi transaction đã commit; lỗi chỉ log, không làm hỏng
 * trạng thái thanh toán.
 */
async function persistNotifications(drafts: NotificationDraft[]): Promise<void> {
  for (const draft of drafts) {
    try {
      await prismaSystem.notification.create({ data: draft });
    } catch (err) {
      console.error('[PaymentNotification]', err);
    }
  }
}

/**
 * Hàm xử lý lõi (một transaction, prismaSystem).
 *
 * Luật 3 + Luật 13 (ghi chú tại chỗ): Webhook/sync là worker hệ thống — không có JWT
 * của người dùng; hành động của Renter (thanh toán, sync) dẫn đến ghi Payment/Invoice
 * và tạo Notification cho cả Renter lẫn Landlord (người khác). Dùng prismaSystem
 * (app_system, BYPASSRLS) và LUÔN lấy tenantId từ dòng Payment theo orderCode;
 * KHÔNG nới lỏng policy RLS để Renter tự ghi, KHÔNG tin tenantId từ body request.
 */
export async function applyPaymentGatewayResult(params: {
  orderCode: bigint | number;
  outcome: PaymentApplyOutcome;
  /** Số tiền đã nhận (từ payOS); null nếu không phải sự kiện thanh toán. */
  paidAmount: number | null;
}): Promise<{ found: boolean }> {
  const orderCode = BigInt(params.orderCode);
  const drafts: NotificationDraft[] = [];

  const result = await prismaSystem.$transaction(async (tx) => {
    const exists = await tx.payment.findUnique({
      where: { orderCode },
      select: { id: true },
    });
    if (!exists) {
      return { found: false as const };
    }
    // Khoa dong de dong bo webhook/sync dong thoi (idempotent).
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${exists.id}::uuid FOR UPDATE`;
    const payment = (await tx.payment.findUnique({
      where: { orderCode },
      select: paymentProcessSelect,
    })) as PaymentProcessRow | null;
    if (!payment) {
      return { found: false as const };
    }

    if (params.outcome === 'NO_CHANGE') {
      return { found: true as const };
    }

    if (params.outcome === 'PAID') {
      // Idempotent: chỉ Payment đã PAID là no-op.
      if (payment.status === PaymentStatus.PAID) {
        return { found: true as const };
      }

      const landlordId = await findLandlordUserId(payment.tenantId);
      const roomCode = payment.invoice.contract.room.roomCode;
      const period = formatPeriod(payment.invoice.billingMonth);

      // Đối chiếu số tiền: lệch -> KHÔNG đánh dấu PAID (D4), thông báo Landlord.
      if (params.paidAmount === null || params.paidAmount !== Number(payment.amount)) {
        console.error('[PaymentAmountMismatch]', {
          orderCode: orderCode.toString(),
          expected: Number(payment.amount),
          received: params.paidAmount,
        });
        if (landlordId) {
          drafts.push({
            tenantId: payment.tenantId,
            userId: landlordId,
            type: 'PAYMENT_AMOUNT_MISMATCH',
            title: 'Số tiền thanh toán không khớp',
            content: `Giao dịch ${orderCode.toString()} (phòng ${roomCode}, kỳ ${period}): kỳ vọng ${Number(payment.amount)} VND, nhận ${params.paidAmount ?? 'không rõ'} VND. Vui lòng đối soát thủ công.`,
            entityId: payment.id,
          });
        }
        return { found: true as const };
      }

      const paidAt = new Date();
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID, paidAt },
      });

      const invoice = payment.invoice;
      if (invoice.status === InvoiceStatus.UNPAID) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.PAID, paidAt },
        });
        drafts.push({
          tenantId: payment.tenantId,
          userId: invoice.contract.renterId,
          type: 'PAYMENT_SUCCESS',
          title: 'Thanh toán thành công',
          content: `Phòng ${roomCode}, kỳ ${period}: đã thanh toán ${Number(payment.amount)} VND.`,
          entityId: invoice.id,
        });
        if (landlordId) {
          drafts.push({
            tenantId: payment.tenantId,
            userId: landlordId,
            type: 'PAYMENT_SUCCESS',
            title: 'Đã nhận thanh toán',
            content: `Phòng ${roomCode}, kỳ ${period}: đã nhận ${Number(payment.amount)} VND.`,
            entityId: invoice.id,
          });
        }
      } else if (invoice.status === InvoiceStatus.CANCELLED) {
        // Tiền đã nhận nhưng hóa đơn đã hủy -> hoàn tiền thủ công (D8, ngoài phạm vi).
        if (landlordId) {
          drafts.push({
            tenantId: payment.tenantId,
            userId: landlordId,
            type: 'PAYMENT_REFUND_REQUIRED',
            title: 'Cần hoàn tiền thanh toán',
            content: `Phòng ${roomCode}, kỳ ${period}: đã nhận ${Number(payment.amount)} VND cho hóa đơn đã hủy. Vui lòng hoàn tiền thủ công.`,
            entityId: payment.id,
          });
        }
      } else if (invoice.status === InvoiceStatus.PAID) {
        // Hóa đơn đã PAID bởi giao dịch khác -> thông báo đối soát cho Landlord.
        if (landlordId) {
          drafts.push({
            tenantId: payment.tenantId,
            userId: landlordId,
            type: 'PAYMENT_RECONCILE',
            title: 'Thanh toán cần đối soát',
            content: `Phòng ${roomCode}, kỳ ${period}: đã nhận ${Number(payment.amount)} VND nhưng hóa đơn đã được thanh toán bởi giao dịch khác.`,
            entityId: payment.id,
          });
        }
      }
      return { found: true as const };
    }

    // CANCELLED/FAILED (từ webhook hủy/thất bại hoặc sync thấy gateway đã hủy):
    // chỉ áp khi Payment còn PENDING; không hạ PAID.
    if (payment.status === PaymentStatus.PENDING) {
      const next =
        params.outcome === 'CANCELLED' ? PaymentStatus.CANCELLED : PaymentStatus.FAILED;
      await tx.payment.update({ where: { id: payment.id }, data: { status: next } });
    }
    return { found: true as const };
  });

  if (!result.found) {
    // orderCode lạ: log và trả 200 để payOS không retry vô hạn.
    console.error('[PaymentWebhook] Không tìm thấy giao dịch theo orderCode', {
      orderCode: orderCode.toString(),
    });
  }

  // Notification SAU commit (chỉ khi thanh toán thành công được ghi nhận).
  await persistNotifications(drafts);
  return result;
}

/**
 * Webhook hủy/thất bại của payOS (success=false): giữ để cập nhật Payment FAILED
 * khi còn PENDING; Invoice giữ nguyên. Không phải luồng chính (mục 6).
 */
export async function applyPayosFailureEvent(data: PayosWebhookData): Promise<void> {
  await applyPaymentGatewayResult({
    orderCode: data.orderCode,
    outcome: 'FAILED',
    paidAmount: null,
  });
}

/**
 * POST /api/webhooks/payos — không JWT; body JSON giới hạn 16kb, đăng ký trước
 * express.json() chung (Q2). Xác thực chữ ký bằng SDK payOS trên object đã parse
 * (verify chỉ là HMAC cục bộ, không cần raw body).
 */
export const handlePayosWebhook = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const body: unknown = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({
        error: { code: 'WEBHOOK_INVALID_PAYLOAD', message: 'Dữ liệu webhook không hợp lệ' },
      });
      return;
    }

    const { data, signature, success } = body as {
      data?: unknown;
      signature?: unknown;
      success?: unknown;
    };
    if (!data || typeof data !== 'object' || typeof signature !== 'string' || !signature) {
      res.status(400).json({
        error: { code: 'WEBHOOK_INVALID_PAYLOAD', message: 'Dữ liệu webhook không hợp lệ' },
      });
      return;
    }

    let verified: PayosWebhookData;
    try {
      verified = await getPaymentGateway().verifyWebhook(body);
    } catch (err) {
      // Lỗi cấu hình cổng thanh toán (thiếu khóa...) KHÔNG phải chữ ký sai.
      if (err instanceof PaymentGatewayError) {
        console.error('[PayosWebhook] Cổng thanh toán chưa sẵn sàng');
        res.status(502).json({
          error: { code: 'PAYMENT_GATEWAY_ERROR', message: 'Cổng thanh toán tạm thời không khả dụng' },
        });
        return;
      }
      // Không log body/chữ ký (Luật 9).
      console.error('[PayosWebhook] Chữ ký webhook không hợp lệ');
      res.status(400).json({
        error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Chữ ký webhook không hợp lệ' },
      });
      return;
    }

    if (success === false) {
      await applyPayosFailureEvent(verified);
    } else {
      await applyPaymentGatewayResult({
        orderCode: verified.orderCode,
        outcome: 'PAID',
        paidAmount: verified.amount,
      });
    }

    // Trả 200 cho: hợp lệ, đã xử lý (idempotent), orderCode lạ — không để payOS retry vô hạn.
    res.status(200).json({ received: true });
  }
);
