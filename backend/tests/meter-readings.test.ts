import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { getCurrentYearMonth } from '../src/lib/timezone';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';

const PASSWORD = 'Password123!';

describe('Module Chỉ số điện nước (UC16, phần UC29) — /api/meter-readings', () => {
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
  let roomBId = '';
  let readingBId = '';

  const rooms: Record<string, string> = {};
  let roomNoContractId = '';

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

  async function createProperty(tenantId: string, name: string): Promise<string> {
    const property = await prismaSystem.property.create({
      data: {
        tenantId,
        name,
        address: name,
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        isActive: true,
      },
    });
    return property.id;
  }

  async function createRoom(tenantId: string, propertyId: string, roomCode: string): Promise<string> {
    const room = await prismaSystem.room.create({
      data: { tenantId, propertyId, roomCode, areaM2: 20, basePrice: 3000000, status: 'OCCUPIED' },
    });
    return room.id;
  }

  async function createContract(tenantId: string, roomId: string, renterId: string): Promise<string> {
    const now = new Date();
    const contract = await prismaSystem.contract.create({
      data: {
        tenantId,
        roomId,
        renterId,
        startDate: now,
        endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        monthlyRent: 3000000,
        deposit: 0,
        status: 'ACTIVE',
      },
    });
    return contract.id;
  }

  function postReading(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/meter-readings').set('Authorization', `Bearer ${token}`).send(body);
  }

  function patchReading(token: string, url: string, body?: Record<string, unknown>) {
    return request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body ?? {});
  }

  function getJson(token: string, url: string) {
    return request(app).get(url).set('Authorization', `Bearer ${token}`);
  }

  function newCode(prefix: string): string {
    return `${prefix}${ts}${Math.floor(Math.random() * 1000)}`;
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
        name: `Gói Chỉ số ${ts}`,
        maxProperties: 5,
        maxRooms: 50,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planId = plan.id;

    const a = await createTenantWithLandlord('Tenant CS A', 'meter.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;
    propertyAId = await createProperty(tenantAId, `Nhà CS A ${ts}`);

    const r1 = await createRenter(tenantAId, 'meter.renter.a1');
    renterA1Id = r1.id;
    renterA1Token = r1.token;
    const r2 = await createRenter(tenantAId, 'meter.renter.a2');
    renterA2Id = r2.id;
    renterA2Token = r2.token;

    for (const code of ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8']) {
      rooms[code] = await createRoom(tenantAId, propertyAId, newCode(code));
    }
    roomNoContractId = await createRoom(tenantAId, propertyAId, newCode('MNC'));

    await createContract(tenantAId, rooms['M1'], renterA1Id);
    await createContract(tenantAId, rooms['M2'], renterA2Id);
    for (const code of ['M3', 'M4', 'M5', 'M6', 'M7', 'M8']) {
      await createContract(tenantAId, rooms[code], renterA1Id);
    }

    const b = await createTenantWithLandlord('Tenant CS B', 'meter.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;
    const propertyB = await createProperty(tenantBId, `Nhà CS B ${ts}`);
    const renterB = await createRenter(tenantBId, 'meter.renter.b1');
    roomBId = await createRoom(tenantBId, propertyB, newCode('MB'));
    await createContract(tenantBId, roomBId, renterB.id);
    const readingB = await prismaSystem.meterReading.create({
      data: {
        tenantId: tenantBId,
        roomId: roomBId,
        billingMonth: new Date('2026-01-01T00:00:00.000Z'),
        electricityIndex: 100,
        waterIndex: 10,
        electricityUsage: 0,
        waterUsage: 0,
      },
    });
    readingBId = readingB.id;
  });

  afterAll(async () => {
    const cleanupTenant = async (tenantId: string) => {
      if (!tenantId) return;
      await prismaSystem.invoice.deleteMany({ where: { tenantId } });
      await prismaSystem.meterReading.deleteMany({ where: { tenantId } });
      await prismaSystem.contract.deleteMany({ where: { tenantId } });
      await prismaSystem.room.deleteMany({ where: { tenantId } });
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

  describe('Múi giờ (APP_TIMEZONE)', () => {
    it('ranh giới tháng theo UTC+7: 00:30 ngày 1 giờ VN đã thuộc tháng mới', () => {
      // 2026-10-31T17:30:00Z = 2026-11-01 00:30 giờ Việt Nam
      expect(getCurrentYearMonth(new Date('2026-10-31T17:30:00.000Z'))).toEqual({
        year: 2026,
        month: 11,
      });
      // 2026-10-31T16:30:00Z = 2026-10-31 23:30 giờ Việt Nam
      expect(getCurrentYearMonth(new Date('2026-10-31T16:30:00.000Z'))).toEqual({
        year: 2026,
        month: 10,
      });
    });
  });

  describe('Phân quyền', () => {
    it('RENTER không tạo/sửa được -> 403', async () => {
      const create = await postReading(renterA1Token, {
        roomId: rooms['M1'],
        billingMonth: '2026-03',
        electricityIndex: 1,
        waterIndex: 1,
      });
      expect(create.status).toBe(403);

      const patch = await patchReading(renterA1Token, `/api/meter-readings/${readingBId}`, {
        electricityIndex: 1,
      });
      expect(patch.status).toBe(403);
    });

    it('ADMIN -> 403 mọi route (Q3)', async () => {
      expect((await getJson(adminToken, '/api/meter-readings')).status).toBe(403);
      expect((await getJson(adminToken, `/api/meter-readings/${readingBId}`)).status).toBe(403);
      expect(
        (await getJson(adminToken, `/api/meter-readings/sheet?propertyId=${propertyAId}&billingMonth=2026-01`))
          .status
      ).toBe(403);
      expect(
        (
          await postReading(adminToken, {
            roomId: rooms['M1'],
            billingMonth: '2026-03',
            electricityIndex: 1,
            waterIndex: 1,
          })
        ).status
      ).toBe(403);
    });
  });

  describe('Cô lập Tenant', () => {
    it('chỉ số Tenant khác -> 404', async () => {
      const res = await getJson(landlordAToken, `/api/meter-readings/${readingBId}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('METER_READING_NOT_FOUND');
    });

    it('phòng Tenant khác -> POST 404 ROOM_NOT_FOUND', async () => {
      const res = await postReading(landlordAToken, {
        roomId: roomBId,
        billingMonth: '2026-02',
        electricityIndex: 1,
        waterIndex: 1,
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    });

    it('danh sách không chứa chỉ số của Tenant khác', async () => {
      const res = await getJson(landlordAToken, '/api/meter-readings');
      expect(res.status).toBe(200);
      expect(res.body.data.some((r: { id: string }) => r.id === readingBId)).toBe(false);
    });
  });

  describe('Renter chỉ thấy phòng thuộc hợp đồng của mình', () => {
    let readingM1Id = '';

    beforeAll(async () => {
      const created = await postReading(landlordAToken, {
        roomId: rooms['M1'],
        billingMonth: '2026-01',
        electricityIndex: 100,
        waterIndex: 10,
      });
      readingM1Id = created.body.data.id;
      await postReading(landlordAToken, {
        roomId: rooms['M2'],
        billingMonth: '2026-01',
        electricityIndex: 200,
        waterIndex: 20,
      });
    });

    it('Renter A1 thấy chỉ số phòng mình, không thấy phòng Renter A2', async () => {
      const list = await getJson(renterA1Token, '/api/meter-readings');
      expect(list.status).toBe(200);
      const roomIds = list.body.data.map((r: { roomId: string }) => r.roomId);
      expect(roomIds).toContain(rooms['M1']);
      expect(roomIds).not.toContain(rooms['M2']);

      const own = await getJson(renterA1Token, `/api/meter-readings/${readingM1Id}`);
      expect(own.status).toBe(200);
    });

    it('Renter A2 không thấy chi tiết chỉ số của Renter A1 -> 404', async () => {
      const res = await getJson(renterA2Token, `/api/meter-readings/${readingM1Id}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Ghi chỉ số (POST)', () => {
    it('tính usage = chỉ số mới - chỉ số kỳ trước; Decimal trả string', async () => {
      const first = await postReading(landlordAToken, {
        roomId: rooms['M3'],
        billingMonth: '2026-01',
        electricityIndex: 100,
        waterIndex: 10,
      });
      expect(first.status).toBe(201);
      expect(first.body.data.electricityUsage).toBe('0');
      expect(first.body.data.waterUsage).toBe('0');
      expect(first.body.data.room.roomCode).toBeTruthy();
      expect(first.body.data.room.propertyId).toBe(propertyAId);
      expect(typeof first.body.data.room.propertyName).toBe('string');

      const second = await postReading(landlordAToken, {
        roomId: rooms['M3'],
        billingMonth: '2026-02',
        electricityIndex: 150,
        waterIndex: 12,
      });
      expect(second.status).toBe(201);
      expect(second.body.data.electricityUsage).toBe('50');
      expect(second.body.data.waterUsage).toBe('2');
    });

    it('kỳ khởi tạo có mốc -> usage = mới - mốc', async () => {
      const res = await postReading(landlordAToken, {
        roomId: rooms['M5'],
        billingMonth: '2026-01',
        electricityIndex: 120,
        waterIndex: 8,
        previousElectricityIndex: 100,
        previousWaterIndex: 5,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.electricityUsage).toBe('20');
      expect(res.body.data.waterUsage).toBe('3');
    });

    it('kỳ tương lai -> 400 INVALID_BILLING_MONTH', async () => {
      const res = await postReading(landlordAToken, {
        roomId: rooms['M4'],
        billingMonth: '2027-12',
        electricityIndex: 1,
        waterIndex: 1,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_BILLING_MONTH');
    });

    it('trùng kỳ -> 409 METER_PERIOD_CONFLICT', async () => {
      const res = await postReading(landlordAToken, {
        roomId: rooms['M3'],
        billingMonth: '2026-02',
        electricityIndex: 160,
        waterIndex: 13,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('METER_PERIOD_CONFLICT');
    });

    it('kỳ không nằm sau kỳ gần nhất -> 409 METER_PERIOD_CONFLICT', async () => {
      const res = await postReading(landlordAToken, {
        roomId: rooms['M3'],
        billingMonth: '2025-12',
        electricityIndex: 90,
        waterIndex: 9,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('METER_PERIOD_CONFLICT');
    });

    it('phòng không có hợp đồng ACTIVE -> 409 NO_ACTIVE_CONTRACT', async () => {
      const res = await postReading(landlordAToken, {
        roomId: roomNoContractId,
        billingMonth: '2026-01',
        electricityIndex: 1,
        waterIndex: 1,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NO_ACTIVE_CONTRACT');
    });

    it('gửi mốc khi phòng đã có kỳ -> 400 PREVIOUS_INDEX_NOT_ALLOWED (Q5)', async () => {
      const res = await postReading(landlordAToken, {
        roomId: rooms['M8'],
        billingMonth: '2026-01',
        electricityIndex: 100,
        waterIndex: 10,
        previousElectricityIndex: 50,
        previousWaterIndex: 5,
      });
      // Kỳ khởi tạo: mốc hợp lệ.
      expect(res.status).toBe(201);

      const res2 = await postReading(landlordAToken, {
        roomId: rooms['M8'],
        billingMonth: '2026-02',
        electricityIndex: 120,
        waterIndex: 12,
        previousElectricityIndex: 100,
        previousWaterIndex: 10,
      });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('PREVIOUS_INDEX_NOT_ALLOWED');
    });
  });

  describe('Bất thường chỉ số giảm (G2)', () => {
    let readingId = '';

    it('chỉ số giảm chưa xác nhận -> 409 METER_INDEX_DECREASED kèm mốc kỳ trước', async () => {
      await postReading(landlordAToken, {
        roomId: rooms['M6'],
        billingMonth: '2026-01',
        electricityIndex: 500,
        waterIndex: 50,
      });

      const res = await postReading(landlordAToken, {
        roomId: rooms['M6'],
        billingMonth: '2026-02',
        electricityIndex: 20,
        waterIndex: 5,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('METER_INDEX_DECREASED');
      expect(res.body.error.details.previousElectricityIndex).toBe('500');
      expect(res.body.error.details.previousWaterIndex).toBe('50');
    });

    it('xác nhận confirmAnomaly -> usage = chỉ số mới (đếm từ 0), không âm, anomaly=true ở chi tiết', async () => {
      const res = await postReading(landlordAToken, {
        roomId: rooms['M6'],
        billingMonth: '2026-02',
        electricityIndex: 20,
        waterIndex: 5,
        confirmAnomaly: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.electricityUsage).toBe('20');
      expect(res.body.data.waterUsage).toBe('5');
      expect(Number(res.body.data.electricityUsage)).toBeGreaterThanOrEqual(0);
      readingId = res.body.data.id;

      const detail = await getJson(landlordAToken, `/api/meter-readings/${readingId}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.anomaly).toBe(true);

      const list = await getJson(landlordAToken, '/api/meter-readings');
      const inList = list.body.data.find((r: { id: string }) => r.id === readingId);
      expect(inList.anomaly).toBeUndefined();
    });

    it('chỉ số bình thường -> anomaly=false ở chi tiết', async () => {
      const res = await getJson(landlordAToken, `/api/meter-readings/${readingId}`);
      expect(res.body.data.id).toBe(readingId);
      const normal = await postReading(landlordAToken, {
        roomId: rooms['M6'],
        billingMonth: '2026-03',
        electricityIndex: 40,
        waterIndex: 8,
      });
      expect(normal.status).toBe(201);
      const detail = await getJson(landlordAToken, `/api/meter-readings/${normal.body.data.id}`);
      expect(detail.body.data.anomaly).toBe(false);
    });
  });

  describe('Sửa chỉ số (PATCH)', () => {
    let firstId = '';
    let secondId = '';

    beforeAll(async () => {
      const first = await postReading(landlordAToken, {
        roomId: rooms['M7'],
        billingMonth: '2026-01',
        electricityIndex: 100,
        waterIndex: 10,
      });
      firstId = first.body.data.id;
      const second = await postReading(landlordAToken, {
        roomId: rooms['M7'],
        billingMonth: '2026-02',
        electricityIndex: 130,
        waterIndex: 13,
      });
      secondId = second.body.data.id;
    });

    it('sửa kỳ không phải gần nhất -> 409 METER_READING_NOT_LATEST (G8)', async () => {
      const res = await patchReading(landlordAToken, `/api/meter-readings/${firstId}`, {
        electricityIndex: 110,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('METER_READING_NOT_LATEST');
    });

    it('sửa kỳ gần nhất -> 200, tính lại usage', async () => {
      const res = await patchReading(landlordAToken, `/api/meter-readings/${secondId}`, {
        electricityIndex: 140,
        waterIndex: 15,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.electricityUsage).toBe('40');
      expect(res.body.data.waterUsage).toBe('5');
    });

    it('chỉ số đã có hóa đơn -> 409 METER_READING_LOCKED (G8)', async () => {
      const reading = await prismaSystem.meterReading.findUnique({ where: { id: secondId } });
      const contract = await prismaSystem.contract.findFirst({
        where: { roomId: reading!.roomId, status: 'ACTIVE' },
      });
      await prismaSystem.invoice.create({
        data: {
          tenantId: tenantAId,
          contractId: contract!.id,
          meterReadingId: secondId,
          billingMonth: reading!.billingMonth,
          electricityUnitPrice: 3500,
          waterUnitPrice: 20000,
          rentAmount: 3000000,
          electricityAmount: 140000,
          waterAmount: 100000,
          serviceAmount: 0,
          totalAmount: 3240000,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await patchReading(landlordAToken, `/api/meter-readings/${secondId}`, {
        electricityIndex: 150,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('METER_READING_LOCKED');
    });

    it('sửa kỳ gần nhất gây chỉ số giảm chưa xác nhận -> 409 METER_INDEX_DECREASED', async () => {
      await postReading(landlordAToken, {
        roomId: rooms['M4'],
        billingMonth: '2026-01',
        electricityIndex: 100,
        waterIndex: 10,
      });
      const second = await postReading(landlordAToken, {
        roomId: rooms['M4'],
        billingMonth: '2026-02',
        electricityIndex: 130,
        waterIndex: 13,
      });

      const res = await patchReading(landlordAToken, `/api/meter-readings/${second.body.data.id}`, {
        electricityIndex: 50,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('METER_INDEX_DECREASED');
      expect(res.body.error.details.previousElectricityIndex).toBe('100');

      const confirmed = await patchReading(landlordAToken, `/api/meter-readings/${second.body.data.id}`, {
        electricityIndex: 50,
        confirmAnomaly: true,
      });
      expect(confirmed.status).toBe(200);
      expect(confirmed.body.data.electricityUsage).toBe('50');
    });
  });

  describe('CHECK ràng buộc usage không âm ở DB', () => {
    it('INSERT trực tiếp usage âm bị DB chặn', async () => {
      await expect(
        prismaSystem.meterReading.create({
          data: {
            tenantId: tenantAId,
            roomId: rooms['M4'],
            billingMonth: new Date('2026-05-01T00:00:00.000Z'),
            electricityIndex: 1,
            waterIndex: 1,
            electricityUsage: -1,
            waterUsage: 0,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Danh sách, chi tiết, sheet (GET)', () => {
    it('lọc theo roomId/propertyId/billingMonth và phân trang', async () => {
      const byRoom = await getJson(landlordAToken, `/api/meter-readings?roomId=${rooms['M3']}`);
      expect(byRoom.status).toBe(200);
      expect(byRoom.body.data.length).toBe(2);
      expect(byRoom.body.data.every((r: { roomId: string }) => r.roomId === rooms['M3'])).toBe(true);

      const byProperty = await getJson(landlordAToken, `/api/meter-readings?propertyId=${propertyAId}`);
      expect(byProperty.status).toBe(200);
      expect(byProperty.body.data.length).toBeGreaterThan(0);

      const byMonth = await getJson(landlordAToken, '/api/meter-readings?billingMonth=2026-02');
      expect(byMonth.status).toBe(200);
      expect(byMonth.body.data.every((r: { billingMonth: string }) => r.billingMonth === '2026-02-01')).toBe(true);

      const paged = await getJson(landlordAToken, '/api/meter-readings?page=1&pageSize=1');
      expect(paged.body.data.length).toBe(1);
    });

    it('sheet trả phòng ACTIVE kèm previous/current/locked/anomaly', async () => {
      const res = await getJson(
        landlordAToken,
        `/api/meter-readings/sheet?propertyId=${propertyAId}&billingMonth=2026-02`
      );
      expect(res.status).toBe(200);
      expect(res.body.propertyName).toBeTruthy();
      expect(Array.isArray(res.body.data)).toBe(true);

      const m3 = res.body.data.find((row: { roomId: string }) => row.roomId === rooms['M3']);
      expect(m3.renter.id).toBeTruthy();
      expect(m3.renter.fullName).toBeTruthy();
      expect(m3.renter.email).toBeUndefined();
      expect(m3.previous.electricityIndex).toBe('100');
      expect(m3.current.electricityIndex).toBe('150');
      expect(m3.locked).toBe(false);

      const m6 = res.body.data.find((row: { roomId: string }) => row.roomId === rooms['M6']);
      expect(m6.anomaly).toBe(true);

      const m7 = res.body.data.find((row: { roomId: string }) => row.roomId === rooms['M7']);
      expect(m7.locked).toBe(true);
    });

    it('sheet thiếu tham số -> 400 VALIDATION_ERROR', async () => {
      const res = await getJson(landlordAToken, '/api/meter-readings/sheet');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Tenant bị tạm ngưng', () => {
    it('mọi route trả 403 TENANT_SUSPENDED', async () => {
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.SUSPENDED },
      });

      const res = await getJson(landlordAToken, '/api/meter-readings');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('TENANT_SUSPENDED');

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.ACTIVE },
      });
    });
  });

  describe('Gói hết hạn', () => {
    it('GET 200, POST 403 SUBSCRIPTION_EXPIRED, PATCH 200 (G5)', async () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      const get = await getJson(landlordAToken, '/api/meter-readings');
      expect(get.status).toBe(200);

      const create = await postReading(landlordAToken, {
        roomId: rooms['M4'],
        billingMonth: '2026-03',
        electricityIndex: 1,
        waterIndex: 1,
      });
      expect(create.status).toBe(403);
      expect(create.body.error.code).toBe('SUBSCRIPTION_EXPIRED');

      const victim = (
        await getJson(landlordAToken, `/api/meter-readings?roomId=${rooms['M5']}`)
      ).body.data[0];
      const update = await patchReading(landlordAToken, `/api/meter-readings/${victim.id}`, {
        electricityIndex: 7,
      });
      expect(update.status).toBe(200);

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: future },
      });
    });
  });
});
