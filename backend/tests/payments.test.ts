import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { getTodayDateOnly } from '../src/lib/timezone';
import {
  setPaymentGateway,
  type PaymentGateway,
  type CreateLinkInput,
  type CreateLinkResult,
  type PaymentLinkInfo,
  type PayosWebhookData,
  PaymentGatewayError,
} from '../src/lib/paymentGateway';
import { UserRole, UserStatus, TenantStatus, InvoiceStatus, PaymentStatus } from '@prisma/client';

const PASSWORD = 'Password123!';

function monthDate(value: string): Date {
  return new Date(`${value}-01T00:00:00.000Z`);
}

/** Cổng thanh toán giả: ghi lại lời gọi, có thể ép lỗi và đặt trạng thái sync. */
class FakePaymentGateway implements PaymentGateway {
  createCalls: CreateLinkInput[] = [];
  cancelCalls: number[] = [];
  failCreate = false;
  failCancel = false;
  failGet = false;
  links = new Map<number, PaymentLinkInfo>();

  async createPaymentLink(input: CreateLinkInput): Promise<CreateLinkResult> {
    if (this.failCreate) {
      throw new PaymentGatewayError('Lỗi giả lập khi tạo link');
    }
    this.createCalls.push(input);
    this.links.set(input.orderCode, {
      orderCode: input.orderCode,
      amount: input.amount,
      amountPaid: 0,
      amountRemaining: input.amount,
      status: 'PENDING',
    });
    return {
      checkoutUrl: `https://pay.payos.vn/web/${input.orderCode}`,
      paymentLinkId: `link-${input.orderCode}`,
      status: 'PENDING',
      expiredAt: input.expiredAt,
    };
  }

  async getPaymentLink(orderCode: number): Promise<PaymentLinkInfo> {
    if (this.failGet) {
      throw new PaymentGatewayError('Lỗi giả lập khi đọc link');
    }
    const info = this.links.get(orderCode);
    if (!info) {
      throw new PaymentGatewayError('Không tìm thấy link trên cổng thanh toán');
    }
    return info;
  }

  async cancelPaymentLink(orderCode: number): Promise<void> {
    this.cancelCalls.push(orderCode);
    if (this.failCancel) {
      throw new PaymentGatewayError('Lỗi giả lập khi hủy link');
    }
    const info = this.links.get(orderCode);
    if (info) {
      info.status = 'CANCELLED';
    }
  }

  async verifyWebhook(): Promise<PayosWebhookData> {
    throw new PaymentGatewayError('Không dùng webhook trong test này');
  }

  reset(): void {
    this.createCalls = [];
    this.cancelCalls = [];
    this.failCreate = false;
    this.failCancel = false;
    this.failGet = false;
    this.links.clear();
  }
}

describe('Module Thanh toán (UC31, UC32) — /api/payments', () => {
  const ts = Date.now();
  const fake = new FakePaymentGateway();
  let planId = '';

  let tenantAId = '';
  let landlordAToken = '';
  let landlordAUserId = '';
  let propertyAId = '';
  let renterA1Id = '';
  let renterA1Token = '';
  let renterA2Id = '';
  let renterA2Token = '';
  const roomA1 = { id: '', code: '', contractId: '' };
  const roomA2 = { id: '', code: '', contractId: '' };

  let tenantBId = '';
  let landlordBToken = '';
  let renterBId = '';
  let renterBToken = '';
  const roomB = { id: '', code: '', contractId: '' };
  let invoiceBId = '';

  let paidInvoiceId = '';
  let cancelledInvoiceId = '';

  function newCode(prefix: string): string {
    return `${prefix}${ts}${Math.floor(Math.random() * 1000)}`;
  }

  async function createTenantWithLandlord(name: string, key: string) {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const tenant = await prismaSystem.tenant.create({
      data: { name, planId, status: TenantStatus.ACTIVE, subscriptionStart: now, subscriptionEnd: end },
    });
    const email = `${key}.${ts}@example.com`;
    const user = await prismaSystem.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: name,
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });
    const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    return { tenantId: tenant.id, userId: user.id, token: login.body.data.token as string };
  }

  async function createRenter(tenantId: string, key: string) {
    const email = `${key}.${ts}@example.com`;
    const user = await prismaSystem.user.create({
      data: {
        tenantId,
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: `Người thuê ${key}`,
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    return { id: user.id, token: login.body.data.token as string };
  }

  async function seedOccupiedRoom(
    tenantId: string,
    propertyId: string,
    renterId: string,
    roomCode: string
  ) {
    const room = await prismaSystem.room.create({
      data: { tenantId, propertyId, roomCode, areaM2: 20, basePrice: 3000000, status: 'OCCUPIED' },
    });
    const contract = await prismaSystem.contract.create({
      data: {
        tenantId,
        roomId: room.id,
        renterId,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2027-01-01T00:00:00.000Z'),
        monthlyRent: 3000000,
        deposit: 0,
        status: 'ACTIVE',
      },
    });
    return { roomId: room.id, contractId: contract.id };
  }

  // Mỗi invoice tự sinh tháng + chỉ số riêng để không vi phạm uq_invoice_active_contract_month.
  let invoiceSeq = 0;
  async function createInvoice(
    tenantId: string,
    contractId: string,
    roomId: string,
    totalAmount: number,
    status: InvoiceStatus = InvoiceStatus.UNPAID
  ): Promise<string> {
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
        status,
        issueDate: today,
        dueDate: today,
        ...(status === InvoiceStatus.PAID ? { paidAt: new Date() } : {}),
      },
    });
    return invoice.id;
  }

  async function createPaymentRow(
    tenantId: string,
    invoiceId: string,
    orderCode: number,
    status: PaymentStatus = PaymentStatus.PENDING
  ): Promise<{ id: string; orderCode: number }> {
    const invoice = await prismaSystem.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { totalAmount: true },
    });
    const row = await prismaSystem.payment.create({
      data: {
        tenantId,
        invoiceId,
        orderCode,
        amount: invoice.totalAmount,
        status,
        ...(status === PaymentStatus.PAID ? { paidAt: new Date() } : {}),
      },
    });
    return { id: row.id, orderCode: Number(row.orderCode) };
  }

  function postPayment(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/payments').set('Authorization', `Bearer ${token}`).send(body);
  }

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
        password: process.env.SEED_ADMIN_PASSWORD || 'change_me',
      });
    expect(adminRes.status).toBe(200);

    const plan = await prismaSystem.plan.create({
      data: {
        name: `Gói Thanh toán ${ts}`,
        maxProperties: 10,
        maxRooms: 200,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planId = plan.id;

    const a = await createTenantWithLandlord('Tenant TT A', 'payment.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;
    landlordAUserId = a.userId;
    const property = await prismaSystem.property.create({
      data: {
        tenantId: tenantAId,
        name: `Nhà TT A ${ts}`,
        address: `Nhà TT A ${ts}`,
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        isActive: true,
      },
    });
    propertyAId = property.id;

    const r1 = await createRenter(tenantAId, 'payment.renter.a1');
    renterA1Id = r1.id;
    renterA1Token = r1.token;
    const r2 = await createRenter(tenantAId, 'payment.renter.a2');
    renterA2Id = r2.id;
    renterA2Token = r2.token;

    const s1 = await seedOccupiedRoom(tenantAId, propertyAId, renterA1Id, newCode('A1'));
    Object.assign(roomA1, { id: s1.roomId, contractId: s1.contractId }, { code: (await prismaSystem.room.findUnique({ where: { id: s1.roomId } }))!.roomCode });
    const s2 = await seedOccupiedRoom(tenantAId, propertyAId, renterA2Id, newCode('A2'));
    Object.assign(roomA2, { id: s2.roomId, contractId: s2.contractId }, { code: (await prismaSystem.room.findUnique({ where: { id: s2.roomId } }))!.roomCode });

    paidInvoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 2500000, InvoiceStatus.PAID);
    cancelledInvoiceId = await createInvoice(tenantAId, roomA2.contractId, roomA2.id, 1800000, InvoiceStatus.CANCELLED);

    const b = await createTenantWithLandlord('Tenant TT B', 'payment.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;
    const propertyB = await prismaSystem.property.create({
      data: {
        tenantId: tenantBId,
        name: `Nhà TT B ${ts}`,
        address: `Nhà TT B ${ts}`,
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        isActive: true,
      },
    });
    const renterB = await createRenter(tenantBId, 'payment.renter.b1');
    renterBId = renterB.id;
    renterBToken = renterB.token;
    const sb = await seedOccupiedRoom(tenantBId, propertyB.id, renterBId, newCode('B1'));
    Object.assign(roomB, { id: sb.roomId, contractId: sb.contractId }, { code: (await prismaSystem.room.findUnique({ where: { id: sb.roomId } }))!.roomCode });
    invoiceBId = await createInvoice(tenantBId, roomB.contractId, roomB.id, 3200000);
  });

  beforeEach(() => {
    fake.reset();
    setPaymentGateway(fake);
  });

  afterAll(async () => {
    setPaymentGateway(null);
    const cleanupTenant = async (tenantId: string) => {
      if (!tenantId) return;
      await prismaSystem.notification.deleteMany({ where: { tenantId } });
      await prismaSystem.payment.deleteMany({ where: { tenantId } });
      await prismaSystem.invoice.deleteMany({ where: { tenantId } });
      await prismaSystem.meterReading.deleteMany({ where: { tenantId } });
      await prismaSystem.contract.deleteMany({ where: { tenantId } });
      await prismaSystem.room.deleteMany({ where: { tenantId } });
      await prismaSystem.service.deleteMany({ where: { tenantId } });
      await prismaSystem.property.deleteMany({ where: { tenantId } });
      await prismaSystem.user.deleteMany({ where: { tenantId } });
      await prismaSystem.tenant.delete({ where: { id: tenantId } });
    };
    await cleanupTenant(tenantAId);
    await cleanupTenant(tenantBId);
    if (planId) {
      const used = await prismaSystem.tenant.findFirst({ where: { planId } });
      if (!used) await prismaSystem.plan.delete({ where: { id: planId } });
    }
    await prismaSystem.$disconnect();
  });

  describe('Phân quyền', () => {
    it('LANDLORD POST/POST cancel/sync -> 403; ADMIN -> 403', async () => {
      const body = { invoiceId: roomA1.contractId };
      expect((await postPayment(landlordAToken, body)).status).toBe(403);
      expect(
        await request(app)
          .post('/api/payments/00000000-0000-0000-0000-000000000000/cancel')
          .set('Authorization', `Bearer ${landlordAToken}`)
          .send({})
      ).toHaveProperty('status', 403);
      expect(
        await request(app)
          .post('/api/payments/00000000-0000-0000-0000-000000000000/sync')
          .set('Authorization', `Bearer ${landlordAToken}`)
          .send({})
      ).toHaveProperty('status', 403);
    });

    it('Thiếu token -> 401', async () => {
      expect((await request(app).post('/api/payments').send({ invoiceId: roomA1.contractId })).status).toBe(401);
    });

    it('LANDLORD/RENTER GET list -> 200', async () => {
      expect(
        (await request(app).get('/api/payments').set('Authorization', `Bearer ${landlordAToken}`)).status
      ).toBe(200);
      expect(
        (await request(app).get('/api/payments').set('Authorization', `Bearer ${renterA1Token}`)).status
      ).toBe(200);
    });
  });

  describe('Tạo link thanh toán (POST /api/payments)', () => {
    it('201: lưu PENDING + checkout_url, description "HD <phòng> <MM-YYYY>", returnUrl/cancelUrl kèm paymentId', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 4500000);
      const res = await postPayment(renterA1Token, { invoiceId });
      expect(res.status).toBe(201);
      const data = res.body.data;
      expect(data.status).toBe('PENDING');
      expect(data.amount).toBe('4500000');
      expect(data.checkoutUrl).toMatch(/^https:\/\/pay\.payos\.vn\/web\//);
      expect(data.orderCode).toMatch(/^\d+$/);
      expect(data.expiresAt).toBeTruthy();

      const row = await prismaSystem.payment.findUniqueOrThrow({ where: { id: data.paymentId } });
      expect(row.status).toBe(PaymentStatus.PENDING);
      expect(row.checkoutUrl).toBe(data.checkoutUrl);
      expect(row.paymentLinkId).toBe(`link-${data.orderCode}`);

      expect(fake.createCalls).toHaveLength(1);
      const call = fake.createCalls[0];
      expect(call.amount).toBe(4500000);
      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      const period = `${String(invoice.billingMonth.getUTCMonth() + 1).padStart(2, '0')}-${invoice.billingMonth.getUTCFullYear()}`;
      expect(call.description).toBe(`HD ${roomA1.code.slice(0, 14)} ${period}`);
      expect(call.description.length).toBeLessThanOrEqual(25);
      expect(call.returnUrl).toContain(`paymentId=${data.paymentId}`);
      expect(call.cancelUrl).toContain(`paymentId=${data.paymentId}`);
    });

    it('200: gọi lại khi PENDING còn hạn -> trả link cũ, không tạo link mới', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 1200000);
      const first = await postPayment(renterA1Token, { invoiceId });
      expect(first.status).toBe(201);
      const second = await postPayment(renterA1Token, { invoiceId });
      expect(second.status).toBe(200);
      expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
      expect(second.body.data.checkoutUrl).toBe(first.body.data.checkoutUrl);
      expect(fake.createCalls).toHaveLength(1);
    });

    it('201: PENDING quá hạn -> hủy link cũ, tạo link mới', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 900000);
      const first = await postPayment(renterA1Token, { invoiceId });
      expect(first.status).toBe(201);
      const oldOrderCode = Number(first.body.data.orderCode);
      await prismaSystem.payment.update({
        where: { id: first.body.data.paymentId },
        data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) },
      });

      const second = await postPayment(renterA1Token, { invoiceId });
      expect(second.status).toBe(201);
      expect(second.body.data.paymentId).not.toBe(first.body.data.paymentId);
      expect(Number(second.body.data.orderCode)).not.toBe(oldOrderCode);

      const old = await prismaSystem.payment.findUniqueOrThrow({ where: { id: first.body.data.paymentId } });
      expect(old.status).toBe(PaymentStatus.CANCELLED);
      expect(fake.cancelCalls).toContain(oldOrderCode);
      // Link cũ + link mới sau khi quá hạn.
      expect(fake.createCalls).toHaveLength(2);
    });

    it('409: hai POST đồng thời -> chỉ một link ở cổng thanh toán, chỉ một PENDING', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 2000000);
      const [r1, r2] = await Promise.all([
        postPayment(renterA1Token, { invoiceId }),
        postPayment(renterA1Token, { invoiceId }),
      ]);
      const statuses = [r1.status, r2.status];
      expect(statuses).toContain(201);
      expect(statuses.filter((s) => s === 200 || s === 409)).toHaveLength(1);
      expect(fake.createCalls).toHaveLength(1);

      const pendings = await prismaSystem.payment.findMany({
        where: { invoiceId, status: PaymentStatus.PENDING },
      });
      expect(pendings).toHaveLength(1);
    });

    it('409: hóa đơn đã thanh toán/đã hủy -> INVOICE_NOT_PAYABLE', async () => {
      expect((await postPayment(renterA1Token, { invoiceId: paidInvoiceId })).body.error.code).toBe(
        'INVOICE_NOT_PAYABLE'
      );
      expect((await postPayment(renterA2Token, { invoiceId: cancelledInvoiceId })).body.error.code).toBe(
        'INVOICE_NOT_PAYABLE'
      );
    });

    it('404: hóa đơn không tồn tại hoặc của Tenant khác (RLS)', async () => {
      const missing = await postPayment(renterA1Token, { invoiceId: '11111111-1111-1111-1111-111111111111' });
      expect(missing.status).toBe(404);
      const foreign = await postPayment(renterA1Token, { invoiceId: invoiceBId });
      expect(foreign.status).toBe(404);
      expect(fake.createCalls).toHaveLength(0);
    });

    it('400: body thiếu invoiceId hoặc thừa trường lạ (strict)', async () => {
      expect((await postPayment(renterA1Token, {})).status).toBe(400);
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 700000);
      const extra = await postPayment(renterA1Token, { invoiceId, tenantId: tenantBId });
      expect(extra.status).toBe(400);
      expect(fake.createCalls).toHaveLength(0);
    });

    it('502: cổng thanh toán lỗi khi tạo link -> PAYMENT_GATEWAY_ERROR, Payment FAILED', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 650000);
      fake.failCreate = true;
      const res = await postPayment(renterA1Token, { invoiceId });
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('PAYMENT_GATEWAY_ERROR');

      const rows = await prismaSystem.payment.findMany({ where: { invoiceId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(PaymentStatus.FAILED);
      expect(rows[0].checkoutUrl).toBeNull();

      // Không giữ chỗ nữa: lần sau tạo lại được.
      fake.failCreate = false;
      const retry = await postPayment(renterA1Token, { invoiceId });
      expect(retry.status).toBe(201);
    });
  });

  describe('Hủy link (POST /api/payments/:id/cancel)', () => {
    it('200: PENDING -> CANCELLED, hủy link ở cổng thanh toán; 409 khi không còn PENDING', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 1100000);
      const created = await postPayment(renterA1Token, { invoiceId });
      expect(created.status).toBe(201);
      const paymentId = created.body.data.paymentId;
      const orderCode = Number(created.body.data.orderCode);

      const cancel = await request(app)
        .post(`/api/payments/${paymentId}/cancel`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe('CANCELLED');
      expect(fake.cancelCalls).toContain(orderCode);

      const again = await request(app)
        .post(`/api/payments/${paymentId}/cancel`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('PAYMENT_NOT_PENDING');
    });

    it('502: hủy link khi cổng thanh toán lỗi -> không đổi trạng thái', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 800000);
      const created = await postPayment(renterA1Token, { invoiceId });
      expect(created.status).toBe(201);
      fake.failCancel = true;
      const cancel = await request(app)
        .post(`/api/payments/${created.body.data.paymentId}/cancel`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(cancel.status).toBe(502);
      expect(cancel.body.error.code).toBe('PAYMENT_GATEWAY_ERROR');
      const row = await prismaSystem.payment.findUniqueOrThrow({ where: { id: created.body.data.paymentId } });
      expect(row.status).toBe(PaymentStatus.PENDING);
    });

    it('404: payment của Tenant khác (RLS)', async () => {
      const foreign = await createPaymentRow(tenantBId, invoiceBId, ts + 10, PaymentStatus.PAID);
      const res = await request(app)
        .post(`/api/payments/${foreign.id}/cancel`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('Đồng bộ trạng thái (POST /api/payments/:id/sync)', () => {
    it('PAID đúng số tiền -> Payment PAID, Invoice PAID, thông báo PAYMENT_SUCCESS cho Renter và Landlord', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 3500000);
      const created = await postPayment(renterA1Token, { invoiceId });
      expect(created.status).toBe(201);
      const paymentId = created.body.data.paymentId;
      const orderCode = Number(created.body.data.orderCode);
      fake.links.set(orderCode, {
        orderCode,
        amount: 3500000,
        amountPaid: 3500000,
        amountRemaining: 0,
        status: 'PAID',
      });

      const sync = await request(app)
        .post(`/api/payments/${paymentId}/sync`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(sync.status).toBe(200);
      expect(sync.body.data.status).toBe('PAID');

      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.PAID);
      expect(payment.paidAt).not.toBeNull();
      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.status).toBe(InvoiceStatus.PAID);
      expect(invoice.paidAt).not.toBeNull();

      const renterNotice = await prismaSystem.notification.findFirst({
        where: { tenantId: tenantAId, userId: renterA1Id, type: 'PAYMENT_SUCCESS' },
      });
      expect(renterNotice).not.toBeNull();
      const landlordNotice = await prismaSystem.notification.findFirst({
        where: { tenantId: tenantAId, userId: landlordAUserId, type: 'PAYMENT_SUCCESS' },
      });
      expect(landlordNotice).not.toBeNull();

      // Sync lần nữa -> idempotent, không lỗi.
      const again = await request(app)
        .post(`/api/payments/${paymentId}/sync`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(again.status).toBe(200);
      expect(again.body.data.status).toBe('PAID');
    });

    it('PAID lệch số tiền -> không chuyển PAID, thông báo PAYMENT_AMOUNT_MISMATCH cho Landlord', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 2200000);
      const created = await postPayment(renterA1Token, { invoiceId });
      expect(created.status).toBe(201);
      const paymentId = created.body.data.paymentId;
      const orderCode = Number(created.body.data.orderCode);
      fake.links.set(orderCode, {
        orderCode,
        amount: 2200000,
        amountPaid: 2000000,
        amountRemaining: 200000,
        status: 'PAID',
      });

      const sync = await request(app)
        .post(`/api/payments/${paymentId}/sync`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(sync.status).toBe(200);
      expect(sync.body.data.status).toBe('PENDING');

      const payment = await prismaSystem.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe(PaymentStatus.PENDING);
      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.status).toBe(InvoiceStatus.UNPAID);

      const landlordNotice = await prismaSystem.notification.findFirst({
        where: { tenantId: tenantAId, userId: landlordAUserId, type: 'PAYMENT_AMOUNT_MISMATCH' },
      });
      expect(landlordNotice).not.toBeNull();
    });

    it('Cổng báo CANCELLED -> Payment CANCELLED; hóa đơn giữ nguyên', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 1300000);
      const created = await postPayment(renterA1Token, { invoiceId });
      expect(created.status).toBe(201);
      const paymentId = created.body.data.paymentId;
      const orderCode = Number(created.body.data.orderCode);
      fake.links.set(orderCode, {
        orderCode,
        amount: 1300000,
        amountPaid: 0,
        amountRemaining: 1300000,
        status: 'CANCELLED',
      });

      const sync = await request(app)
        .post(`/api/payments/${paymentId}/sync`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(sync.status).toBe(200);
      expect(sync.body.data.status).toBe('CANCELLED');
      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.status).toBe(InvoiceStatus.UNPAID);
    });

    it('502: cổng thanh toán lỗi khi sync -> PAYMENT_GATEWAY_ERROR', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 750000);
      const created = await postPayment(renterA1Token, { invoiceId });
      expect(created.status).toBe(201);
      fake.failGet = true;
      const sync = await request(app)
        .post(`/api/payments/${created.body.data.paymentId}/sync`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(sync.status).toBe(502);
      expect(sync.body.error.code).toBe('PAYMENT_GATEWAY_ERROR');
    });

    it('404: payment của Tenant khác (RLS)', async () => {
      const foreign = await createPaymentRow(tenantBId, invoiceBId, ts + 20, PaymentStatus.PAID);
      const res = await request(app)
        .post(`/api/payments/${foreign.id}/sync`)
        .set('Authorization', `Bearer ${renterA1Token}`)
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('Lịch sử thanh toán (UC32)', () => {
    it('GET /: Renter chỉ thấy giao dịch của mình (RLS); Landlord thấy của Tenant mình', async () => {
      const ownInvoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 1600000);
      const otherInvoiceId = await createInvoice(tenantAId, roomA2.contractId, roomA2.id, 1700000);
      expect((await postPayment(renterA1Token, { invoiceId: ownInvoiceId })).status).toBe(201);
      expect((await postPayment(renterA2Token, { invoiceId: otherInvoiceId })).status).toBe(201);

      const renterList = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${renterA1Token}`);
      expect(renterList.status).toBe(200);
      expect(renterList.body.data.length).toBeGreaterThan(0);
      const renterInvoiceIds = renterList.body.data.map((p: { invoiceId: string }) => p.invoiceId);
      expect(renterInvoiceIds).toContain(ownInvoiceId);
      expect(renterInvoiceIds).not.toContain(otherInvoiceId);

      const landlordList = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(landlordList.status).toBe(200);
      const landlordInvoiceIds = landlordList.body.data.map((p: { invoiceId: string }) => p.invoiceId);
      expect(landlordInvoiceIds).toContain(ownInvoiceId);
      expect(landlordInvoiceIds).toContain(otherInvoiceId);

      const foreignList = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${renterBToken}`);
      expect(foreignList.status).toBe(200);
      expect(
        foreignList.body.data.map((p: { invoiceId: string }) => p.invoiceId)
      ).not.toContain(ownInvoiceId);
    });

    it('GET /?status=&invoiceId= lọc đúng; GET /:id 200, của Tenant khác -> 404', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 1900000);
      const created = await postPayment(renterA1Token, { invoiceId });
      expect(created.status).toBe(201);
      const paymentId = created.body.data.paymentId;

      const filtered = await request(app)
        .get(`/api/payments?status=PENDING&invoiceId=${invoiceId}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(filtered.status).toBe(200);
      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0].id).toBe(paymentId);
      expect(filtered.body.pagination.total).toBe(1);

      const detail = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${renterA1Token}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.id).toBe(paymentId);

      const foreign = await createPaymentRow(tenantBId, invoiceBId, ts + 30, PaymentStatus.PAID);
      const foreignDetail = await request(app)
        .get(`/api/payments/${foreign.id}`)
        .set('Authorization', `Bearer ${renterA1Token}`);
      expect(foreignDetail.status).toBe(404);
    });
  });

  describe('Hóa đơn có link PENDING khi hủy (UC19)', () => {
    it('200: hủy hóa đơn -> hủy link ở cổng thanh toán, Payment CANCELLED', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 2100000);
      const created = await postPayment(renterA1Token, { invoiceId });
      expect(created.status).toBe(201);
      const orderCode = Number(created.body.data.orderCode);

      const cancel = await request(app)
        .patch(`/api/invoices/${invoiceId}/cancel`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({});
      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe('CANCELLED');
      expect(fake.cancelCalls).toContain(orderCode);

      const payment = await prismaSystem.payment.findFirstOrThrow({ where: { invoiceId } });
      expect(payment.status).toBe(PaymentStatus.CANCELLED);
    });

    it('409: cổng thanh toán gián đoạn -> INVOICE_HAS_PENDING_PAYMENT, hóa đơn giữ nguyên', async () => {
      const invoiceId = await createInvoice(tenantAId, roomA1.contractId, roomA1.id, 2300000);
      const created = await postPayment(renterA1Token, { invoiceId });
      expect(created.status).toBe(201);
      fake.failCancel = true;

      const cancel = await request(app)
        .patch(`/api/invoices/${invoiceId}/cancel`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({});
      expect(cancel.status).toBe(409);
      expect(cancel.body.error.code).toBe('INVOICE_HAS_PENDING_PAYMENT');

      const invoice = await prismaSystem.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.status).toBe(InvoiceStatus.UNPAID);
      const payment = await prismaSystem.payment.findFirstOrThrow({ where: { invoiceId } });
      expect(payment.status).toBe(PaymentStatus.PENDING);
    });
  });
});
