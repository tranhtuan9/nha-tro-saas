import { PayOS, WebhookError, PayOSError } from '@payos/node';
import type {
  CreatePaymentLinkResponse,
  PaymentLink,
  PaymentLinkStatus,
  WebhookData,
} from '@payos/node';

/**
 * Interface bọc cổng thanh toán payOS (UC31, UC32):
 * - Bọc SDK @payos/node (ghim phiên bản trong package.json); không lộ khóa ra ngoài.
 * - Test thay bằng bản giả qua setPaymentGateway() (giống lib/llm.ts).
 * - Lỗi cổng thanh toán trả về cho client luôn là 502 PAYMENT_GATEWAY_ERROR
 *   với thông báo tiếng Việt trung tính (không lộ chi tiết SDK).
 */

export type PayosWebhookData = WebhookData;
export type GatewayPaymentLinkStatus = PaymentLinkStatus;

export interface CreateLinkInput {
  orderCode: number;
  /** Số nguyên VND, lấy từ invoice.totalAmount — không nhận từ client. */
  amount: number;
  /** "HD <roomCode> <MM-YYYY>" không dấu, tối đa 25 ký tự, không PII. */
  description: string;
  returnUrl: string;
  cancelUrl: string;
  /** Thời điểm link hết hạn (tính từ PAYMENT_LINK_TTL_MINUTES). */
  expiredAt: Date;
}

export interface CreateLinkResult {
  checkoutUrl: string;
  paymentLinkId: string;
  status: string;
  expiredAt: Date | null;
}

/** Kết quả lời gọi lấy thông tin link/giao dịch từ payOS. */
export interface PaymentLinkInfo {
  orderCode: number;
  amount: number;
  amountPaid: number;
  amountRemaining: number;
  status: GatewayPaymentLinkStatus;
}

/** Lỗi gọi cổng thanh toán (sai khóa, gián đoạn, timeout...) → API trả 502. */
export class PaymentGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

export interface PaymentGateway {
  createPaymentLink(input: CreateLinkInput): Promise<CreateLinkResult>;
  getPaymentLink(orderCode: number): Promise<PaymentLinkInfo>;
  cancelPaymentLink(orderCode: number, reason?: string): Promise<void>;
  /** Xác thực chữ ký webhook (HMAC-SHA256 theo checksum key). Ném lỗi khi sai. */
  verifyWebhook(body: unknown): Promise<PayosWebhookData>;
}

/**
 * Triển khai chính thức bằng SDK @payos/node.
 * - create/get/cancel gọi API thật của payOS (ném PaymentGatewayError khi lỗi).
 * - verifyWebhook chỉ là tính toán HMAC cục bộ, KHÔNG gọi mạng.
 */
export class PayosPaymentGateway implements PaymentGateway {
  private readonly payos: PayOS;

  constructor(options: { clientId: string; apiKey: string; checksumKey: string }) {
    this.payos = new PayOS(options);
  }

  async createPaymentLink(input: CreateLinkInput): Promise<CreateLinkResult> {
    try {
      const result: CreatePaymentLinkResponse = await this.payos.paymentRequests.create({
        orderCode: input.orderCode,
        amount: input.amount,
        description: input.description,
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
        // payOS nhận expiredAt dạng unix (giây).
        expiredAt: Math.floor(input.expiredAt.getTime() / 1000),
      });
      return {
        checkoutUrl: result.checkoutUrl,
        paymentLinkId: result.paymentLinkId,
        status: result.status,
        expiredAt: result.expiredAt ? new Date(result.expiredAt * 1000) : null,
      };
    } catch (err) {
      throw new PaymentGatewayError(describeGatewayError(err));
    }
  }

  async getPaymentLink(orderCode: number): Promise<PaymentLinkInfo> {
    try {
      const link: PaymentLink = await this.payos.paymentRequests.get(orderCode);
      return {
        orderCode: link.orderCode,
        amount: link.amount,
        amountPaid: link.amountPaid,
        amountRemaining: link.amountRemaining,
        status: link.status,
      };
    } catch (err) {
      throw new PaymentGatewayError(describeGatewayError(err));
    }
  }

  async cancelPaymentLink(orderCode: number, reason?: string): Promise<void> {
    try {
      await this.payos.paymentRequests.cancel(orderCode, reason);
    } catch (err) {
      throw new PaymentGatewayError(describeGatewayError(err));
    }
  }

  async verifyWebhook(body: unknown): Promise<PayosWebhookData> {
    try {
      return await this.payos.webhooks.verify(body as Parameters<PayOS['webhooks']['verify']>[0]);
    } catch (err) {
      if (err instanceof WebhookError || err instanceof PayOSError) {
        throw err;
      }
      throw new PaymentGatewayError('Không xác thực được chữ ký webhook');
    }
  }
}

/** Mô tả lỗi ngắn gọn, không kèm khóa/chữ ký/body. */
function describeGatewayError(err: unknown): string {
  if (err instanceof PayOSError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

let gateway: PaymentGateway | null = null;

/**
 * Lấy gateway hiện tại; khởi tạo lazily từ biến môi trường PAYOS_*.
 * Thiếu cấu hình → PaymentGatewayError (xử lý như lỗi cổng thanh toán).
 */
export function getPaymentGateway(): PaymentGateway {
  if (!gateway) {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!clientId || !apiKey || !checksumKey) {
      throw new PaymentGatewayError('Cổng thanh toán chưa được cấu hình');
    }
    gateway = new PayosPaymentGateway({ clientId, apiKey, checksumKey });
  }
  return gateway;
}

/** Seam cho test: truyền fake gateway; truyền null để reset về gateway thật. */
export function setPaymentGateway(next: PaymentGateway | null): void {
  gateway = next;
}
