import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { getTodayDateOnly } from '../src/lib/timezone';
import * as invoiceService from '../src/modules/invoices/service';
import { UserRole, UserStatus, TenantStatus, InvoiceStatus } from '@prisma/client';

const PASSWORD = 'Password123!';
const MONTH = '2026-05';

function monthDate(value: string): Date {
  return new Date(`${value}-01T00:00:00.000Z`);
}

function todayString(): string {
  return getTodayDateOnly().toISOString().slice(0, 10);
}

function addDaysString(days: number): string {
  return new Date(getTodayDateOnly().getTime() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

describe('Module Hóa đơn (UC18, UC19, UC30) — /api/invoices', () => {
  const ts = Date.now();
  let adminToken = '';
  let planId = '';

  let tenantAId = '';
  let landlordAToken = '';
  let propertyAId = '';
  let renterA1Id = '';
  let renterA1Token = '';
  let renterA2Id = '';
  let renterA2Token = '';

  let tenantBId = '';
  let landlordBToken = '';
  let invoiceBId = '';

  let serviceXId = '';
  let serviceYId = '';
  let serviceOffId = '';
  let serviceZId = '';
  let serviceRoundId = '';
  let serviceHugeId = '';

  const contract: Record<string, string> = {};
  const reading: Record<string, string> = {};
  let calcInvoiceId = '';

  let tenantSId = '';
  let landlordSToken = '';

  async function createTenantWithLandlord(name: string, key: string) {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const tenant = await prismaSystem.tenant.create({
      data: { name, planId, status: TenantStatus.ACTIVE, subscriptionStart: now, subscriptionEnd: end },
    });
    const email = `${key}.${ts}@example.com`;
    await prismaSystem.user.create({
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
    return { tenantId: tenant.id, token: login.body.data.token as string };
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

  async function createProperty(
    tenantId: string,
    name: string,
    electricityUnitPrice = 3500,
    waterUnitPrice = 20000
  ): Promise<string> {
    const property = await prismaSystem.property.create({
      data: { tenantId, name, address: name, electricityUnitPrice, waterUnitPrice, isActive: true },
    });
    return property.id;
  }

  async function createService(
    tenantId: string,
    propertyId: string,
    name: string,
    unitPrice: number,
    isActive = true
  ): Promise<string> {
    const service = await prismaSystem.service.create({
      data: { tenantId, propertyId, name, unit: 'lần', unitPrice, isActive },
    });
    return service.id;
  }

  async function createRoom(tenantId: string, propertyId: string, roomCode: string): Promise<string> {
    const room = await prismaSystem.room.create({
      data: { tenantId, propertyId, roomCode, areaM2: 20, basePrice: 3000000, status: 'OCCUPIED' },
    });
    return room.id;
  }

  async function createContract(
    tenantId: string,
    roomId: string,
    renterId: string,
    startDate: Date = new Date('2026-01-01T00:00:00.000Z')
  ): Promise<string> {
    const row = await prismaSystem.contract.create({
      data: {
        tenantId,
        roomId,
        renterId,
        startDate,
        endDate: new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000),
        monthlyRent: 3000000,
        deposit: 0,
        status: 'ACTIVE',
      },
    });
    return row.id;
  }

  async function createReading(
    tenantId: string,
    roomId: string,
    billingMonth: string,
    electricityUsage = 10,
    waterUsage = 2
  ): Promise<string> {
    const row = await prismaSystem.meterReading.create({
      data: {
        tenantId,
        roomId,
        billingMonth: monthDate(billingMonth),
        electricityIndex: 100 + electricityUsage,
        waterIndex: 10 + waterUsage,
        electricityUsage,
        waterUsage,
      },
    });
    return row.id;
  }

  // Tạo hợp đồng (+ chỉ số nếu có) cho một phòng, ghi vào contract/reading theo key.
  async function seedRoom(
    key: string,
    propertyId: string,
    renterId: string,
    opts: { readingMonth?: string; electricityUsage?: number; waterUsage?: number; startDate?: Date } = {}
  ) {
    const roomId = await createRoom(tenantAId, propertyId, newCode(key));
    contract[key] = await createContract(tenantAId, roomId, renterId, opts.startDate);
    if (opts.readingMonth) {
      reading[key] = await createReading(
        tenantAId,
        roomId,
        opts.readingMonth,
        opts.electricityUsage,
        opts.waterUsage
      );
    }
    return roomId;
  }

  function newCode(prefix: string): string {
    return `${prefix}${ts}${Math.floor(Math.random() * 1000)}`;
  }

  function postInvoice(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(body);
  }

  function postPreview(token: string, body: Record<string, unknown>) {
    return request(app)
      .post('/api/invoices/preview')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  function patchInvoice(token: string, url: string) {
    return request(app).patch(url).set('Authorization', `Bearer ${token}`).send({});
  }

  function getJson(token: string, url: string) {
    return request(app).get(url).set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
        password: process.env.SEED_ADMIN_PASSWORD || 'change_me',
      });
    adminToken = adminRes.body.data.token;

    const plan = await prismaSystem.plan.create({
      data: {
        name: `Gói Hóa đơn ${ts}`,
        maxProperties: 10,
        maxRooms: 200,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planId = plan.id;

    const a = await createTenantWithLandlord('Tenant HD A', 'invoice.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;
    propertyAId = await createProperty(tenantAId, `Nhà HD A ${ts}`);
    const propertyA2 = await createProperty(tenantAId, `Nhà HD A2 ${ts}`);
    const propertyR = await createProperty(tenantAId, `Nhà HD Làm tròn ${ts}`, 3333, 3333);

    serviceXId = await createService(tenantAId, propertyAId, `DV X ${ts}`, 5000);
    serviceYId = await createService(tenantAId, propertyAId, `DV Y ${ts}`, 150000);
    serviceOffId = await createService(tenantAId, propertyAId, `DV Ngừng ${ts}`, 1000, false);
    serviceZId = await createService(tenantAId, propertyA2, `DV Z ${ts}`, 20000);
    serviceRoundId = await createService(tenantAId, propertyR, `DV Làm tròn ${ts}`, 3333);
    serviceHugeId = await createService(
      tenantAId,
      propertyAId,
      `DV Quá khổ ${ts}`,
      999999999999
    );

    const r1 = await createRenter(tenantAId, 'invoice.renter.a1');
    renterA1Id = r1.id;
    renterA1Token = r1.token;
    const r2 = await createRenter(tenantAId, 'invoice.renter.a2');
    renterA2Id = r2.id;
    renterA2Token = r2.token;

    await seedRoom('CALC', propertyAId, renterA1Id, {
      readingMonth: MONTH,
      electricityUsage: 50,
      waterUsage: 3,
    });
    await seedRoom('NOSVC', propertyAId, renterA1Id, { readingMonth: MONTH });
    await seedRoom('NOREAD', propertyAId, renterA1Id);
    await seedRoom('SVC', propertyAId, renterA1Id, { readingMonth: MONTH, electricityUsage: 1, waterUsage: 1 });
    await seedRoom('DUE', propertyAId, renterA1Id, { readingMonth: MONTH, electricityUsage: 1, waterUsage: 1 });
    await seedRoom('RACE', propertyAId, renterA1Id, { readingMonth: MONTH });
    await seedRoom('ROLL', propertyAId, renterA1Id, { readingMonth: MONTH });
    await seedRoom('RANGE', propertyAId, renterA1Id, { readingMonth: MONTH });
    await seedRoom('CANCEL', propertyAId, renterA1Id, { readingMonth: MONTH });
    await seedRoom('OVD', propertyAId, renterA1Id, { readingMonth: '2026-04' });
    await seedRoom('PREV', propertyAId, renterA1Id, { readingMonth: MONTH });
    const expRoomId = await seedRoom('EXP', propertyAId, renterA1Id, { readingMonth: MONTH });
    await seedRoom('TERM', propertyAId, renterA1Id, { readingMonth: MONTH });
    await seedRoom('RA2', propertyAId, renterA2Id, { readingMonth: MONTH });
    // Kỳ 06 cho test PAID không cho hủy (trên phòng EXP, tránh làm CANCEL có kỳ sau).
    await createReading(tenantAId, expRoomId, '2026-06');
    // Hợp đồng bắt đầu giữa tháng: lập kỳ trước tháng bắt đầu -> BEFORE_CONTRACT_START.
    const midRoomId = await seedRoom('MID', propertyAId, renterA1Id, {
      startDate: new Date('2026-06-15T00:00:00.000Z'),
    });
    // Chỉ số cho MID dùng khi test preview lúc gói hết hạn (preview không yêu cầu gói).
    await createReading(tenantAId, midRoomId, '2026-07');
    // Phòng làm tròn half-up: đơn giá 3333, usage 1.5.
    const roundRoomId = await createRoom(tenantAId, propertyR, newCode('ROUND'));
    contract['ROUND'] = await createContract(tenantAId, roundRoomId, renterA1Id);
    await prismaSystem.meterReading.create({
      data: {
        tenantId: tenantAId,
        roomId: roundRoomId,
        billingMonth: monthDate(MONTH),
        electricityIndex: 101.5,
        waterIndex: 11.5,
        electricityUsage: 1.5,
        waterUsage: 1.5,
      },
    });

    const b = await createTenantWithLandlord('Tenant HD B', 'invoice.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;
    const propertyB = await createProperty(tenantBId, `Nhà HD B ${ts}`);
    await createService(tenantBId, propertyB, `DV B ${ts}`, 1000);
    const renterB = await createRenter(tenantBId, 'invoice.renter.b1');
    const roomBId = await createRoom(tenantBId, propertyB, newCode('IB'));
    const contractBId = await createContract(tenantBId, roomBId, renterB.id);
    const readingBId = await createReading(tenantBId, roomBId, '2026-01');
    const invoiceB = await prismaSystem.invoice.create({
      data: {
        tenantId: tenantBId,
        contractId: contractBId,
        meterReadingId: readingBId,
        billingMonth: monthDate('2026-01'),
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        rentAmount: 3000000,
        electricityAmount: 0,
        waterAmount: 0,
        serviceAmount: 0,
        totalAmount: 3000000,
        status: InvoiceStatus.UNPAID,
        issueDate: getTodayDateOnly(),
        dueDate: getTodayDateOnly(),
      },
    });
    invoiceBId = invoiceB.id;

    // Tenant riêng cho test summary có số liệu xác định.
    const s = await createTenantWithLandlord('Tenant HD S', 'invoice.landlord.s');
    tenantSId = s.tenantId;
    landlordSToken = s.token;
    const propertyS = await createProperty(tenantSId, `Nhà HD S ${ts}`);
    const renterS = await createRenter(tenantSId, 'invoice.renter.s1');
    for (const key of ['S1', 'S2', 'S3', 'S4']) {
      const roomId = await createRoom(tenantSId, propertyS, newCode(key));
      const month = key === 'S1' || key === 'S2' ? '2026-07' : '2026-08';
      const contractId = await createContract(
        tenantSId,
        roomId,
        renterS.id,
        new Date('2026-06-01T00:00:00.000Z')
      );
      await createReading(tenantSId, roomId, month, 0, 0);
      const created = await postInvoice(landlordSToken, { contractId, billingMonth: month });
      if (created.status !== 201) throw new Error(`Seed invoice ${key} failed: ${JSON.stringify(created.body)}`);
      if (key === 'S1') {
        await prismaSystem.invoice.update({
          where: { id: created.body.data.id },
          data: { status: InvoiceStatus.PAID, paidAt: new Date() },
        });
      } else if (key === 'S3') {
        await prismaSystem.invoice.update({
          where: { id: created.body.data.id },
          data: { dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });
      } else if (key === 'S4') {
        await prismaSystem.invoice.update({
          where: { id: created.body.data.id },
          data: { status: InvoiceStatus.CANCELLED },
        });
      }
    }
  });

  afterAll(async () => {
    const cleanupTenant = async (tenantId: string) => {
      if (!tenantId) return;
      await prismaSystem.notification.deleteMany({ where: { tenantId } });
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
    await cleanupTenant(tenantSId);
    if (planId) {
      const used = await prismaSystem.tenant.findFirst({ where: { planId } });
      if (!used) await prismaSystem.plan.delete({ where: { id: planId } });
    }
    await prismaSystem.$disconnect();
  });

  describe('Phân quyền', () => {
    it('RENTER không POST/preview/cancel/summary -> 403', async () => {
      const body = { contractId: contract['CALC'], billingMonth: MONTH };
      expect((await postInvoice(renterA1Token, body)).status).toBe(403);
      expect(
        (await request(app).post('/api/invoices/preview').set('Authorization', `Bearer ${renterA1Token}`).send(body)).status
      ).toBe(403);
      expect((await patchInvoice(renterA1Token, `/api/invoices/${invoiceBId}/cancel`)).status).toBe(403);
      expect((await getJson(renterA1Token, '/api/invoices/summary')).status).toBe(403);
    });

    it('ADMIN -> 403 mọi route', async () => {
      expect((await getJson(adminToken, '/api/invoices')).status).toBe(403);
      expect((await getJson(adminToken, `/api/invoices/${invoiceBId}`)).status).toBe(403);
      expect((await getJson(adminToken, '/api/invoices/summary')).status).toBe(403);
      expect(
        (await postInvoice(adminToken, { contractId: contract['CALC'], billingMonth: MONTH })).status
      ).toBe(403);
      expect(
        (await request(app).post('/api/invoices/preview').set('Authorization', `Bearer ${adminToken}`).send({})).status
      ).toBe(403);
      expect((await patchInvoice(adminToken, `/api/invoices/${invoiceBId}/cancel`)).status).toBe(403);
    });
  });

  describe('Xem trước (POST /preview)', () => {
    it('200 đúng số liệu, không phát sinh hóa đơn trong DB', async () => {
      const res = await postPreview(landlordAToken, {
        contractId: contract['PREV'],
        billingMonth: MONTH,
        services: [{ serviceId: serviceXId, quantity: 2 }],
      });
      expect(res.status).toBe(200);
      expect(res.body.data.effectiveStatus).toBe('UNPAID');
      expect(res.body.data.electricityAmount).toBe('35000');
      expect(res.body.data.waterAmount).toBe('40000');
      expect(res.body.data.serviceAmount).toBe('10000');
      expect(res.body.data.totalAmount).toBe('3085000');
      expect(res.body.data.lineItems).toHaveLength(1);

      const count = await prismaSystem.invoice.count({
        where: { contractId: contract['PREV'], billingMonth: monthDate(MONTH) },
      });
      expect(count).toBe(0);
    });

    it('thiếu chỉ số đúng kỳ vẫn 409 METER_READING_REQUIRED', async () => {
      const res = await postPreview(landlordAToken, {
        contractId: contract['NOREAD'],
        billingMonth: MONTH,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('METER_READING_REQUIRED');
    });

    it('kỳ tương lai -> 400 INVALID_BILLING_MONTH reason=FUTURE', async () => {
      const res = await postPreview(landlordAToken, {
        contractId: contract['PREV'],
        billingMonth: '2099-01',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_BILLING_MONTH');
      expect(res.body.error.details.reason).toBe('FUTURE');
    });
  });

  describe('Lập hóa đơn (POST /) — tính tiền, làm tròn, snapshot', () => {
    it('tính đủ 4 thành phần; Decimal string; dueDate mặc định = hôm nay + INVOICE_DUE_DAYS', async () => {
      const res = await postInvoice(landlordAToken, {
        contractId: contract['CALC'],
        billingMonth: MONTH,
        services: [
          { serviceId: serviceXId, quantity: 2 },
          { serviceId: serviceYId, quantity: 1 },
        ],
      });
      expect(res.status).toBe(201);
      calcInvoiceId = res.body.data.id;
      expect(res.body.data.rentAmount).toBe('3000000');
      expect(res.body.data.electricityAmount).toBe('175000');
      expect(res.body.data.waterAmount).toBe('60000');
      expect(res.body.data.serviceAmount).toBe('160000');
      expect(res.body.data.totalAmount).toBe('3395000');
      expect(res.body.data.status).toBe('UNPAID');
      expect(res.body.data.billingMonth).toBe(MONTH);
      expect(res.body.data.issueDate).toBe(todayString());
      expect(res.body.data.dueDate).toBe(addDaysString(10));
      expect(res.body.data.lineItems).toHaveLength(2);
      expect(res.body.data.room.roomCode).toBeTruthy();
      expect(res.body.data.renter.id).toBe(renterA1Id);

      const detail = await getJson(landlordAToken, `/api/invoices/${calcInvoiceId}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.lineItems[0].serviceName).toBeTruthy();
      expect(detail.body.data.lineItems[0].amount).toBe('10000');
      expect(detail.body.data.renter.email).toBeUndefined();
      expect(detail.body.data.renter.nationalId).toBeUndefined();
    });

    it('không dịch vụ -> serviceAmount = 0, không dòng dịch vụ', async () => {
      const res = await postInvoice(landlordAToken, {
        contractId: contract['NOSVC'],
        billingMonth: MONTH,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.serviceAmount).toBe('0');
      expect(res.body.data.lineItems).toHaveLength(0);
      expect(res.body.data.totalAmount).toBe('3075000');
    });

    it('làm tròn half-up từng thành phần: 3333 × 1.5 = 5000', async () => {
      const res = await postInvoice(landlordAToken, {
        contractId: contract['ROUND'],
        billingMonth: MONTH,
        services: [{ serviceId: serviceRoundId, quantity: 1.5 }],
      });
      expect(res.status).toBe(201);
      expect(res.body.data.electricityAmount).toBe('5000');
      expect(res.body.data.waterAmount).toBe('5000');
      expect(res.body.data.serviceAmount).toBe('5000');
      expect(res.body.data.totalAmount).toBe('3015000');
    });

    it('snapshot: sửa đơn giá dịch vụ + đơn giá nhà trọ sau lập không đổi hóa đơn cũ', async () => {
      const before = await getJson(landlordAToken, `/api/invoices/${calcInvoiceId}`);
      await prismaSystem.service.update({ where: { id: serviceXId }, data: { unitPrice: 9999 } });
      await prismaSystem.property.update({
        where: { id: propertyAId },
        data: { electricityUnitPrice: 9999, waterUnitPrice: 9999 },
      });

      const after = await getJson(landlordAToken, `/api/invoices/${calcInvoiceId}`);
      expect(after.body.data.electricityAmount).toBe(before.body.data.electricityAmount);
      expect(after.body.data.waterAmount).toBe(before.body.data.waterAmount);
      expect(after.body.data.electricityUnitPrice).toBe('3500');
      expect(after.body.data.lineItems.find((i: { serviceId: string }) => i.serviceId === serviceXId).unitPrice).toBe('5000');

      await prismaSystem.service.update({ where: { id: serviceXId }, data: { unitPrice: 5000 } });
      await prismaSystem.property.update({
        where: { id: propertyAId },
        data: { electricityUnitPrice: 3500, waterUnitPrice: 20000 },
      });
    });

    it('tạo Notification NEW_INVOICE cho Renter sau khi lập', async () => {
      const notification = await prismaSystem.notification.findFirst({
        where: { userId: renterA1Id, type: 'NEW_INVOICE', entityId: calcInvoiceId },
      });
      expect(notification).not.toBeNull();
      expect(notification?.title).toBe('Hóa đơn mới');
      expect(notification?.content).toContain(MONTH);
    });

    it('dueDate = hôm nay được phép; dueDate < hôm nay -> 400 INVALID_DUE_DATE', async () => {
      const past = await postInvoice(landlordAToken, {
        contractId: contract['DUE'],
        billingMonth: MONTH,
        dueDate: addDaysString(-1),
      });
      expect(past.status).toBe(400);
      expect(past.body.error.code).toBe('INVALID_DUE_DATE');

      const today = await postInvoice(landlordAToken, {
        contractId: contract['DUE'],
        billingMonth: MONTH,
        dueDate: todayString(),
      });
      expect(today.status).toBe(201);
      expect(today.body.data.dueDate).toBe(todayString());
    });
  });

  describe('Validate khi lập hóa đơn', () => {
    it('thiếu chỉ số đúng kỳ -> 409 METER_READING_REQUIRED', async () => {
      const res = await postInvoice(landlordAToken, {
        contractId: contract['NOREAD'],
        billingMonth: MONTH,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('METER_READING_REQUIRED');
    });

    it('hợp đồng TERMINATED -> 409 CONTRACT_NOT_ACTIVE; Tenant khác -> 404', async () => {
      await prismaSystem.contract.update({
        where: { id: contract['TERM'] },
        data: { status: 'TERMINATED' },
      });
      const res = await postInvoice(landlordAToken, {
        contractId: contract['TERM'],
        billingMonth: MONTH,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONTRACT_NOT_ACTIVE');

      const other = await postInvoice(landlordAToken, {
        contractId: invoiceBId,
        billingMonth: MONTH,
      });
      expect(other.status).toBe(404);
      expect(other.body.error.code).toBe('CONTRACT_NOT_FOUND');
    });

    it('kỳ tương lai -> reason=FUTURE; trước tháng bắt đầu hợp đồng -> reason=BEFORE_CONTRACT_START', async () => {
      const future = await postInvoice(landlordAToken, {
        contractId: contract['SVC'],
        billingMonth: '2099-01',
      });
      expect(future.status).toBe(400);
      expect(future.body.error.code).toBe('INVALID_BILLING_MONTH');
      expect(future.body.error.details.reason).toBe('FUTURE');

      const beforeStart = await postInvoice(landlordAToken, {
        contractId: contract['MID'],
        billingMonth: '2026-05',
      });
      expect(beforeStart.status).toBe(400);
      expect(beforeStart.body.error.code).toBe('INVALID_BILLING_MONTH');
      expect(beforeStart.body.error.details.reason).toBe('BEFORE_CONTRACT_START');
    });

    it('dịch vụ ngừng / nhà trọ khác / Tenant khác -> 400 SERVICE_NOT_APPLICABLE', async () => {
      const off = await postInvoice(landlordAToken, {
        contractId: contract['SVC'],
        billingMonth: MONTH,
        services: [{ serviceId: serviceOffId, quantity: 1 }],
      });
      expect(off.status).toBe(400);
      expect(off.body.error.code).toBe('SERVICE_NOT_APPLICABLE');

      const otherProperty = await postInvoice(landlordAToken, {
        contractId: contract['SVC'],
        billingMonth: MONTH,
        services: [{ serviceId: serviceZId, quantity: 1 }],
      });
      expect(otherProperty.status).toBe(400);
      expect(otherProperty.body.error.code).toBe('SERVICE_NOT_APPLICABLE');

      const otherTenant = await postInvoice(landlordAToken, {
        contractId: contract['SVC'],
        billingMonth: MONTH,
        services: [{ serviceId: serviceXId, quantity: 1 }],
      });
      // serviceX thuộc đúng nhà trọ -> hợp lệ; dùng service Tenant B (không thấy qua RLS -> SERVICE_NOT_APPLICABLE).
      expect(otherTenant.status).toBe(201);
      await prismaSystem.invoice.delete({ where: { id: otherTenant.body.data.id } });

      const foreignService = await prismaSystem.service.findFirst({ where: { tenantId: tenantBId } });
      const foreign = await postInvoice(landlordAToken, {
        contractId: contract['SVC'],
        billingMonth: MONTH,
        services: [{ serviceId: foreignService?.id ?? serviceXId, quantity: 1 }],
      });
      expect(foreign.status).toBe(400);
      expect(foreign.body.error.code).toBe('SERVICE_NOT_APPLICABLE');
    });

    it('trùng serviceId / quantity <= 0 / quantity tràn -> 400 VALIDATION_ERROR', async () => {
      const dup = await postInvoice(landlordAToken, {
        contractId: contract['SVC'],
        billingMonth: MONTH,
        services: [
          { serviceId: serviceXId, quantity: 1 },
          { serviceId: serviceXId, quantity: 2 },
        ],
      });
      expect(dup.status).toBe(400);
      expect(dup.body.error.code).toBe('VALIDATION_ERROR');

      const zero = await postInvoice(landlordAToken, {
        contractId: contract['SVC'],
        billingMonth: MONTH,
        services: [{ serviceId: serviceXId, quantity: 0 }],
      });
      expect(zero.status).toBe(400);
      expect(zero.body.error.code).toBe('VALIDATION_ERROR');

      // Zod chặn quantity tràn decimal(8,2) trước khi chạm DB (Q5).
      const overflow = await postInvoice(landlordAToken, {
        contractId: contract['SVC'],
        billingMonth: MONTH,
        services: [{ serviceId: serviceXId, quantity: 1e10 }],
      });
      expect(overflow.status).toBe(400);
      expect(overflow.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('amount vượt decimal(12,0) -> 400 AMOUNT_OUT_OF_RANGE thay vì 500', async () => {
      const res = await postInvoice(landlordAToken, {
        contractId: contract['RANGE'],
        billingMonth: MONTH,
        services: [{ serviceId: serviceHugeId, quantity: 2 }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('AMOUNT_OUT_OF_RANGE');
      const count = await prismaSystem.invoice.count({
        where: { contractId: contract['RANGE'], billingMonth: monthDate(MONTH) },
      });
      expect(count).toBe(0);
    });

    it('trùng hợp đồng + kỳ (P2002) -> 409 INVOICE_ALREADY_EXISTS; chỉ số khóa -> 409 METER_READING_LOCKED', async () => {
      const locked = await postInvoice(landlordAToken, {
        contractId: contract['CALC'],
        billingMonth: MONTH,
      });
      expect(locked.status).toBe(409);
      expect(locked.body.error.code).toBe('METER_READING_LOCKED');
    });
  });

  describe('Race và rollback', () => {
    it('2 POST cùng hợp đồng + kỳ -> một 201, một 409', async () => {
      const body = { contractId: contract['RACE'], billingMonth: MONTH };
      const [a, b] = await Promise.all([
        postInvoice(landlordAToken, body),
        postInvoice(landlordAToken, body),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 409]);
      // Request về sau có thể dính P2002 (INVOICE_ALREADY_EXISTS) hoặc bị khóa chỉ số
      // (METER_READING_LOCKED) tùy timing — cả hai đều là 409 đúng luật.
      const failed = a.status === 409 ? a : b;
      expect(['INVOICE_ALREADY_EXISTS', 'METER_READING_LOCKED']).toContain(failed.body.error.code);
    });

    it('dòng dịch vụ ném lỗi sau khi Invoice đã chèn -> transaction rollback, không còn Invoice (Q5)', async () => {
      const spy = vi
        .spyOn(invoiceService.invoiceLineItemWriter, 'createMany')
        .mockRejectedValueOnce(new Error('forced line item failure'));

      const res = await postInvoice(landlordAToken, {
        contractId: contract['ROLL'],
        billingMonth: MONTH,
        services: [{ serviceId: serviceXId, quantity: 1 }],
      });
      spy.mockRestore();

      expect(res.status).toBe(500);
      const count = await prismaSystem.invoice.count({
        where: { contractId: contract['ROLL'], billingMonth: monthDate(MONTH) },
      });
      expect(count).toBe(0);
    });
  });

  describe('Hủy hóa đơn và khóa chỉ số (regression UC16)', () => {
    let cancelInvoiceId = '';
    let cancelReadingId = '';

    it('hủy UNPAID -> CANCELLED; hủy lại idempotent; lập lại cùng kỳ sau hủy -> 201', async () => {
      const created = await postInvoice(landlordAToken, {
        contractId: contract['CANCEL'],
        billingMonth: MONTH,
      });
      expect(created.status).toBe(201);
      cancelInvoiceId = created.body.data.id;
      cancelReadingId = created.body.data.meterReadingId;

      const cancelled = await patchInvoice(landlordAToken, `/api/invoices/${cancelInvoiceId}/cancel`);
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.status).toBe('CANCELLED');

      const again = await patchInvoice(landlordAToken, `/api/invoices/${cancelInvoiceId}/cancel`);
      expect(again.status).toBe(200);
      expect(again.body.data.status).toBe('CANCELLED');

      const reissued = await postInvoice(landlordAToken, {
        contractId: contract['CANCEL'],
        billingMonth: MONTH,
      });
      expect(reissued.status).toBe(201);
    });

    it('khóa chỉ số: chưa hủy -> 409; sau hủy -> sửa được và /sheet locked=false; lập lại -> locked=true', async () => {
      // Hóa đơn đã hủy (cancelInvoiceId) và đã lập lại (reissued ở test trước) — hủy bản lập lại để kiểm chứng.
      const list = await getJson(
        landlordAToken,
        `/api/invoices?contractId=${contract['CANCEL']}&billingMonth=${MONTH}`
      );
      const active = list.body.data.find((i: { status: string }) => i.status !== 'CANCELLED');
      expect(active).toBeTruthy();

      const patchLocked = await request(app)
        .patch(`/api/meter-readings/${cancelReadingId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ electricityIndex: 200 });
      expect(patchLocked.status).toBe(409);
      expect(patchLocked.body.error.code).toBe('METER_READING_LOCKED');

      await patchInvoice(landlordAToken, `/api/invoices/${active.id}/cancel`);

      const patchAfter = await request(app)
        .patch(`/api/meter-readings/${cancelReadingId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ electricityIndex: 200 });
      expect(patchAfter.status).toBe(200);

      const sheet = await getJson(
        landlordAToken,
        `/api/meter-readings/sheet?propertyId=${propertyAId}&billingMonth=${MONTH}`
      );
      const row = sheet.body.data.find((r: { roomId: string }) => r.roomId === active.room.id);
      expect(row.locked).toBe(false);

      const reissued = await postInvoice(landlordAToken, {
        contractId: contract['CANCEL'],
        billingMonth: MONTH,
      });
      expect(reissued.status).toBe(201);

      const sheet2 = await getJson(
        landlordAToken,
        `/api/meter-readings/sheet?propertyId=${propertyAId}&billingMonth=${MONTH}`
      );
      const row2 = sheet2.body.data.find((r: { roomId: string }) => r.roomId === active.room.id);
      expect(row2.locked).toBe(true);
    });

    it('PAID -> 409 INVOICE_ALREADY_PAID; không thấy hóa đơn -> 404', async () => {
      const created = await postInvoice(landlordAToken, {
        contractId: contract['EXP'],
        billingMonth: '2026-06',
      });
      expect(created.status).toBe(201);
      await prismaSystem.invoice.update({
        where: { id: created.body.data.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });

      const res = await patchInvoice(landlordAToken, `/api/invoices/${created.body.data.id}/cancel`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVOICE_ALREADY_PAID');

      const missing = await patchInvoice(
        landlordAToken,
        '/api/invoices/00000000-0000-4000-8000-000000000000/cancel'
      );
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('INVOICE_NOT_FOUND');
    });
  });

  describe('OVERDUE tính khi đọc', () => {
    let overdueInvoiceId = '';

    beforeAll(async () => {
      const created = await postInvoice(landlordAToken, {
        contractId: contract['OVD'],
        billingMonth: '2026-04',
      });
      overdueInvoiceId = created.body.data.id;
      await prismaSystem.invoice.update({
        where: { id: overdueInvoiceId },
        data: { dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
    });

    it('quá hạn -> status hiệu dụng OVERDUE; bộ lọc UNPAID/OVERDUE tách bạch', async () => {
      const detail = await getJson(landlordAToken, `/api/invoices/${overdueInvoiceId}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.status).toBe('OVERDUE');

      const overdueList = await getJson(
        landlordAToken,
        `/api/invoices?status=OVERDUE&contractId=${contract['OVD']}`
      );
      expect(overdueList.body.data).toHaveLength(1);
      expect(overdueList.body.data[0].id).toBe(overdueInvoiceId);

      const unpaidList = await getJson(
        landlordAToken,
        `/api/invoices?status=UNPAID&contractId=${contract['OVD']}`
      );
      expect(unpaidList.body.data).toHaveLength(0);

      const defaultList = await getJson(
        landlordAToken,
        `/api/invoices?contractId=${contract['OVD']}`
      );
      expect(defaultList.body.data[0].status).toBe('OVERDUE');
    });
  });

  describe('Renter xem hóa đơn (UC30) và cô lập Tenant', () => {
    it('Renter chỉ thấy hóa đơn của mình (RLS)', async () => {
      const ra2 = await postInvoice(landlordAToken, {
        contractId: contract['RA2'],
        billingMonth: MONTH,
      });
      expect(ra2.status).toBe(201);

      const listA1 = await getJson(renterA1Token, '/api/invoices');
      expect(listA1.status).toBe(200);
      const ids = listA1.body.data.map((i: { id: string }) => i.id);
      expect(ids).toContain(calcInvoiceId);
      expect(ids).not.toContain(ra2.body.data.id);

      const own = await getJson(renterA1Token, `/api/invoices/${calcInvoiceId}`);
      expect(own.status).toBe(200);
      expect(own.body.data.lineItems.length).toBeGreaterThan(0);

      const foreign = await getJson(renterA1Token, `/api/invoices/${ra2.body.data.id}`);
      expect(foreign.status).toBe(404);

      const a2sees = await getJson(renterA2Token, `/api/invoices/${ra2.body.data.id}`);
      expect(a2sees.status).toBe(200);
    });

    it('Landlord Tenant khác -> 404; danh sách không lẫn chéo', async () => {
      const detail = await getJson(landlordBToken, `/api/invoices/${calcInvoiceId}`);
      expect(detail.status).toBe(404);

      const listB = await getJson(landlordBToken, '/api/invoices');
      expect(listB.body.data.some((i: { id: string }) => i.id === calcInvoiceId)).toBe(false);

      const listA = await getJson(landlordAToken, '/api/invoices');
      expect(listA.body.data.some((i: { id: string }) => i.id === invoiceBId)).toBe(false);
    });
  });

  describe('Tổng hợp doanh thu (GET /summary — UC19)', () => {
    it('đủ tổng + số lượng issued/paid/unpaid/overdue/cancelled + outstanding', async () => {
      const res = await getJson(landlordSToken, '/api/invoices/summary');
      expect(res.status).toBe(200);
      expect(res.body.data.month).toBeNull();
      expect(res.body.data.issuedCount).toBe(3);
      expect(res.body.data.issuedTotal).toBe('9000000');
      expect(res.body.data.paidCount).toBe(1);
      expect(res.body.data.paidTotal).toBe('3000000');
      expect(res.body.data.paidRevenue).toBe('3000000');
      expect(res.body.data.unpaidCount).toBe(1);
      expect(res.body.data.unpaidTotal).toBe('3000000');
      expect(res.body.data.overdueCount).toBe(1);
      expect(res.body.data.overdueTotal).toBe('3000000');
      expect(res.body.data.cancelledCount).toBe(1);
      expect(res.body.data.outstandingCount).toBe(2);
      expect(res.body.data.outstandingTotal).toBe('6000000');
    });

    it('month lọc đúng kỳ', async () => {
      const res = await getJson(landlordSToken, '/api/invoices/summary?month=2026-07');
      expect(res.status).toBe(200);
      expect(res.body.data.month).toBe('2026-07');
      expect(res.body.data.issuedCount).toBe(2);
      expect(res.body.data.issuedTotal).toBe('6000000');
      expect(res.body.data.paidCount).toBe(1);
      expect(res.body.data.unpaidCount).toBe(1);
      expect(res.body.data.overdueCount).toBe(0);
      expect(res.body.data.cancelledCount).toBe(0);
      expect(res.body.data.outstandingCount).toBe(1);
      expect(res.body.data.outstandingTotal).toBe('3000000');
    });
  });

  describe('Gói hết hạn', () => {
    it('POST -> 403 SUBSCRIPTION_EXPIRED; preview/GET/cancel/summary -> 200', async () => {
      const created = await postInvoice(landlordAToken, {
        contractId: contract['EXP'],
        billingMonth: MONTH,
      });
      expect(created.status).toBe(201);

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      const post = await postInvoice(landlordAToken, {
        contractId: contract['EXP'],
        billingMonth: '2026-09',
      });
      expect(post.status).toBe(403);
      expect(post.body.error.code).toBe('SUBSCRIPTION_EXPIRED');

      const preview = await request(app)
        .post('/api/invoices/preview')
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ contractId: contract['MID'], billingMonth: '2026-07' });
      expect(preview.status).toBe(200);

      const list = await getJson(landlordAToken, '/api/invoices');
      expect(list.status).toBe(200);

      const summary = await getJson(landlordAToken, '/api/invoices/summary');
      expect(summary.status).toBe(200);

      const cancel = await patchInvoice(landlordAToken, `/api/invoices/${created.body.data.id}/cancel`);
      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe('CANCELLED');

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
    });
  });
});
