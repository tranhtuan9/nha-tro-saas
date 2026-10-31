import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { setPaymentGateway } from '../src/lib/paymentGateway';
import { getTodayDateOnly } from '../src/lib/timezone';
import { UserRole, UserStatus, TenantStatus, InvoiceStatus, PaymentStatus } from '@prisma/client';

// Checksum key test: vitest chạy mỗi file trong process riêng; chỉ đổi env tại đây.
const TEST_CHECKSUM_KEY = 'test-checksum-key-0123456789abcdef';

/**
 * Ký HMAC-SHA256 đúng thuật toán của SDK payOS (NodeCryptoProvider):
 * sắp xếp khóa, nối query string (null -> ''), rồi HMAC với checksum key.
 */
function signWebhookData(data: Record<string, unknown>, key: string): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce((acc, k) => {
      acc[k] = data[k];
      return acc;
    }, {} as Record<string, unknown>);
  const query = Object.keys(sorted)
    .filter((k) => sorted[k] !== undefined)
    .map((k) => {
      let value = sorted[k];
      if ([null, undefined, 'undefined', 'null'].includes(value as string)) {
        value = '';
      }
      return `${k}=${value}`;
    })
    .join('&');
  return crypto.createHmac('sha256', key).update(query).digest('hex');
}

function webhookData(orderCode: number, amount: number): Record<string, unknown> {
  return {
    orderCode,
    amount,
    description: 'HD TEST 05-2026',
    accountNumber: '0123456789',
    reference: `REF${orderCode}`,
    transactionDateTime: '2026-05-10 10:00:00',
    currency: 'VND',
    paymentLinkId: `link-${orderCode}`,
    code: '00',
    desc: 'success',
  };
}

function postWebhook(body: unknown) {
  return request(app).post('/api/webhooks/payos').send(body);
}

function signedBody(
  data: Record<string, unknown>,
  opts: { success?: boolean; key?: string; signature?: string } = {}
) {
  const { success = true, key = TEST_CHECKSUM_KEY, signature } = opts;
  return {
    code: '00',
    desc: 'success',
    success,
    data,
    signature: signature ?? signWebhookData(data, key),
  };
}

function monthDate(value: string): Date {
  return new Date(`${value}-01T00:00:00.000Z`);
}

describe('Webhook payOS — POST /api/webhooks/payos', () => {
  const ts = Date.now();
  let planId = '';
  let tenantId = '';
  let landlordUserId = '';
  let renterUserId = '';
  let propertyId = '';
  let roomId = '';
  let contractId = '';
  let orderSeq = 0;
  let invoiceSeq = 0;

  function nextOrderCode(): number {
    orderSeq += 1;
    return ts * 100 + orderSeq;
  }

  // Mỗi invoice tự sinh tháng + chỉ số riêng để không vi phạm uq_invoice_active_contract_month.
  async function seedInvoice(totalAmount: number): Promise<string> {
    invoiceSeq += 1;
    const month = ((invoiceSeq - 1) % 12) + 1;
    const year = 2026 + Math.floor((invoiceSeq - 1) / 12);
    const billingMonth = monthDate(`${year}-${String(month).padStart(2, '0')}`);
    const today = getTodayDateOnly();
    const reading = await prismaSystem.meterReading.create({
      data: {
        tenantId,
        roomId,
        billingMonth,
        electricityIndex: 100,
        waterIndex: 10,
        electricityUsage: 0,
        waterUsage: 0,
      },
    });
    const invoice = await prismaSystem.invoice.create({
      data: {
        tenantId,
        contractId,
        meterReadingId: reading.id,
        billingMonth,
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        rentAmount: totalAmount,
        electricityAmount: 0,
        waterAmount: 0,
        serviceAmount: 0,
        totalAmount,
        status: InvoiceStatus.UNPAID,
        issueDate: today,
        dueDate: today,
      },
    });
    return invoice.id;
  }

  async function seedPayment(
    invoiceId: string,
    orderCode: number,
    status: PaymentStatus = PaymentStatus.PENDING
  ): Promise<string> {
    const invoice = await prismaSystem.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { totalAmount: true },
    });
    const payment = await prismaSystem.payment.create({
      data: {
        tenantId,
        invoiceId,
        orderCode,
        amount: invoice.totalAmount,
        status,
        ...(status === PaymentStatus.PAID ? { paidAt: new Date() } : {}),
      },
    });
    return payment.id;
  }

  beforeAll(async () => {
    // Ghi đè khóa trước lần gọi gateway đầu tiên (verify là HMAC cục bộ, không gọi mạng).
    process.env.PAYOS_CLIENT_ID = 'test-client-id';
    process.env.PAYOS_API_KEY = 'test-api-key';
    process.env.PAYOS_CHECKSUM_KEY = TEST_CHECKSUM_KEY;
    setPaymentGateway(null);

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const plan = await prismaSystem.plan.create({
      data: {
        name: `Gói Webhook ${ts}`,
        maxProperties: 10,
        maxRooms: 200,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planId = plan.id;

    const tenant = await prismaSystem.tenant.create({
      data: {
        name: `Tenant Webhook ${ts}`,
        planId,
        status: TenantStatus.ACTIVE,
        subscriptionStart: now,
        subscriptionEnd: end,
      },
    });
    tenantId = tenant.id;

    const landlord = await prismaSystem.user.create({
      data: {
        tenantId,
        email: `webhook.landlord.${ts}@example.com`,
        passwordHash: await bcrypt.hash('Password123!', 10),
        fullName: 'Chủ trọ Webhook',
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });
    landlordUserId = landlord.id;

    const renter = await prismaSystem.user.create({
      data: {
        tenantId,
        email: `webhook.renter.${ts}@example.com`,
        passwordHash: await bcrypt.hash('Password123!', 10),
        fullName: 'Người thuê Webhook',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    renterUserId = renter.id;

    const property = await prismaSystem.property.create({
      data: {
        tenantId,
        name: `Nhà Webhook ${ts}`,
        address: `Nhà Webhook ${ts}`,
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        isActive: true,
      },
    });
    propertyId = property.id;

    const room = await prismaSystem.room.create({
      data: {
        tenantId,
        propertyId,
        roomCode: `WH${ts}`,
        areaM2: 20,
        basePrice: 3000000,
        status: 'OCCUPIED',
      },
    });
    roomId = room.id;

    const contract = await prismaSystem.contract.create({
      data: {
        tenantId,
        roomId,
        renterId: renterUserId,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2027-01-01T00:00:00.000Z'),
        monthlyRent: 3000000,
        deposit: 0,
        status: 'ACTIVE',
      },
    });
    contractId = contract.id;
  });

  afterAll(async () => {
    setPaymentGateway(null);
    if (tenantId) {
      await prismaSystem.notification.deleteMany({ where: { tenantId } });
      await prismaSystem.payment.deleteMany({ where: { tenantId } });
      await prismaSystem.invoice.deleteMany({ where: { tenantId } });
      await prismaSystem.meterReading.deleteMany({ where: { tenantId } });
      await prismaSystem.contract.deleteMany({ where: { tenantId } });
      await prismaSystem.room.deleteMany({ where: { tenantId } });
      await prismaSystem.property.deleteMany({ where: { tenantId } });
      await prismaSystem.user.deleteMany({ where: { tenantId } });
      await prismaSystem.tenant.delete({ where: { id: tenantId } });
    }
    if (planId) {
      const used = await prismaSystem.tenant.findFirst({ where: { planId } });
      if (!used) await prismaSystem.plan.delete({ where: { id: planId } });
    }
    await prismaSystem.$disconnect();
  });

  describe('Xác thực & payload', () => {
    it('400: chữ ký sai -> không đổi trạng thái', async () => {
      const invoiceId = await seedInvoice(1000000);
      const orderCode = nextOrderCode();
      const paymentId = await seedPayment(invoiceId, orderCode);

      const res = await postWebhook(signedBody(webhookData(orderCode, 1000000), { key: 'sai-key' }));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');

      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.PENDING);
    });

    it('400: thiếu data hoặc signature; body không phải object', async () => {
      expect((await postWebhook({ signature: 'abc' })).status).toBe(400);
      expect((await postWebhook({ data: webhookData(1, 1) })).status).toBe(400);
      expect((await postWebhook([1, 2, 3])).status).toBe(400);
      expect((await postWebhook('chuoi')).status).toBe(400);
    });

    it('200: payload webhook đăng ký (orderCode lạ, chữ ký hợp lệ) -> chấp nhận, không lỗi', async () => {
      const orderCode = nextOrderCode();
      const res = await postWebhook(signedBody(webhookData(orderCode, 500000)));
      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });

  describe('Webhook báo thành công (success=true)', () => {
    it('PAID đúng số tiền -> Payment PAID, Invoice PAID, thông báo PAYMENT_SUCCESS', async () => {
      const invoiceId = await seedInvoice(2000000);
      const orderCode = nextOrderCode();
      const paymentId = await seedPayment(invoiceId, orderCode);

      const res = await postWebhook(signedBody(webhookData(orderCode, 2000000)));
      expect(res.status).toBe(200);

      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.PAID);
      expect(payment.paidAt).not.toBeNull();
      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.status).toBe(InvoiceStatus.PAID);

      const renterNotice = await prismaSystem.notification.findFirst({
        where: { tenantId, userId: renterUserId, type: 'PAYMENT_SUCCESS' },
      });
      expect(renterNotice).not.toBeNull();
      const landlordNotice = await prismaSystem.notification.findFirst({
        where: { tenantId, userId: landlordUserId, type: 'PAYMENT_SUCCESS' },
      });
      expect(landlordNotice).not.toBeNull();
    });

    it('Webhook lặp lại -> idempotent, paidAt không đổi', async () => {
      const invoiceId = await seedInvoice(1500000);
      const orderCode = nextOrderCode();
      const paymentId = await seedPayment(invoiceId, orderCode);

      expect((await postWebhook(signedBody(webhookData(orderCode, 1500000)))).status).toBe(200);
      const first = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(first.status).toBe(PaymentStatus.PAID);

      expect((await postWebhook(signedBody(webhookData(orderCode, 1500000)))).status).toBe(200);
      const second = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(second.paidAt?.getTime()).toBe(first.paidAt?.getTime());

      const notices = await prismaSystem.notification.count({
        where: { tenantId, type: 'PAYMENT_SUCCESS', entityId: invoiceId },
      });
      expect(notices).toBe(2);
    });

    it('Payment CANCELLED nhưng webhook báo PAID đúng tiền -> vẫn chuyển PAID', async () => {
      const invoiceId = await seedInvoice(1750000);
      const orderCode = nextOrderCode();
      const paymentId = await seedPayment(invoiceId, orderCode, PaymentStatus.CANCELLED);

      const res = await postWebhook(signedBody(webhookData(orderCode, 1750000)));
      expect(res.status).toBe(200);

      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.PAID);
      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.status).toBe(InvoiceStatus.PAID);
    });

    it('Payment FAILED nhưng webhook báo PAID đúng tiền -> vẫn chuyển PAID', async () => {
      const invoiceId = await seedInvoice(1650000);
      const orderCode = nextOrderCode();
      const paymentId = await seedPayment(invoiceId, orderCode, PaymentStatus.FAILED);

      const res = await postWebhook(signedBody(webhookData(orderCode, 1650000)));
      expect(res.status).toBe(200);
      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.PAID);
    });

    it('Số tiền lệch -> không PAID, thông báo PAYMENT_AMOUNT_MISMATCH cho Landlord', async () => {
      const invoiceId = await seedInvoice(2100000);
      const orderCode = nextOrderCode();
      const paymentId = await seedPayment(invoiceId, orderCode);

      const res = await postWebhook(signedBody(webhookData(orderCode, 2000000)));
      expect(res.status).toBe(200);

      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.PENDING);
      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.status).toBe(InvoiceStatus.UNPAID);

      const landlordNotice = await prismaSystem.notification.findFirst({
        where: { tenantId, userId: landlordUserId, type: 'PAYMENT_AMOUNT_MISMATCH' },
      });
      expect(landlordNotice).not.toBeNull();
    });

    it('Hóa đơn đã hủy nhưng tiền về -> Payment PAID, thông báo PAYMENT_REFUND_REQUIRED', async () => {
      const invoiceId = await seedInvoice(1400000);
      await prismaSystem.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.CANCELLED },
      });
      const orderCode = nextOrderCode();
      const paymentId = await seedPayment(invoiceId, orderCode);

      const res = await postWebhook(signedBody(webhookData(orderCode, 1400000)));
      expect(res.status).toBe(200);

      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.PAID);
      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.status).toBe(InvoiceStatus.CANCELLED);

      const landlordNotice = await prismaSystem.notification.findFirst({
        where: { tenantId, userId: landlordUserId, type: 'PAYMENT_REFUND_REQUIRED' },
      });
      expect(landlordNotice).not.toBeNull();
    });

    it('Hóa đơn đã PAID bởi giao dịch khác -> Payment PAID, thông báo PAYMENT_RECONCILE', async () => {
      const invoiceId = await seedInvoice(1900000);
      await prismaSystem.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });
      const orderCode = nextOrderCode();
      const paymentId = await seedPayment(invoiceId, orderCode);

      const res = await postWebhook(signedBody(webhookData(orderCode, 1900000)));
      expect(res.status).toBe(200);

      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.PAID);

      const landlordNotice = await prismaSystem.notification.findFirst({
        where: { tenantId, userId: landlordUserId, type: 'PAYMENT_RECONCILE' },
      });
      expect(landlordNotice).not.toBeNull();
    });
  });

  describe('Webhook báo thất bại (success=false)', () => {
    it('Payment PENDING -> FAILED; hóa đơn giữ nguyên', async () => {
      const invoiceId = await seedInvoice(1250000);
      const orderCode = nextOrderCode();
      const paymentId = await seedPayment(invoiceId, orderCode);

      const res = await postWebhook(signedBody(webhookData(orderCode, 1250000), { success: false }));
      expect(res.status).toBe(200);

      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.FAILED);
      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.status).toBe(InvoiceStatus.UNPAID);
    });
  });
});
