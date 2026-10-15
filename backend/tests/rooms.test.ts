import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { UserRole, UserStatus, TenantStatus, ContractStatus, RoomStatus } from '@prisma/client';

const PASSWORD = 'Password123!';

describe('Module Phòng (UC13) — /api/rooms', () => {
  const ts = Date.now();
  let adminToken = '';
  let planNormalId = '';
  let planRoomLimitId = '';

  let tenantAId = '';
  let landlordAToken = '';
  let renterAToken = '';
  let renterAId = '';
  let propertyA1Id = '';
  let propertyA2Id = '';
  let propertyA3Id = '';
  let roomActiveId = '';

  let tenantBId = '';
  let landlordBToken = '';
  let propertyBId = '';
  let roomBId = '';

  let tenantRoomLimitId = '';
  let landlordRoomLimitToken = '';
  let propertyRL1Id = '';
  let propertyRL2Id = '';

  let tenantConcId = '';
  let landlordConcToken = '';
  let propertyConcId = '';

  async function createTenantWithLandlord(name: string, planId: string, key: string) {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const tenant = await prismaSystem.tenant.create({
      data: {
        name,
        planId,
        status: TenantStatus.ACTIVE,
        subscriptionStart: now,
        subscriptionEnd: end,
      },
    });
    const email = `${key}.${ts}@example.com`;
    const landlord = await prismaSystem.user.create({
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
    return { tenantId: tenant.id, landlordId: landlord.id, email, token: login.body.data.token as string };
  }

  async function createProperty(
    tenantId: string,
    name: string,
    isActive = true
  ): Promise<string> {
    const property = await prismaSystem.property.create({
      data: {
        tenantId,
        name,
        address: name,
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        isActive,
      },
    });
    return property.id;
  }

  async function createRoom(
    tenantId: string,
    propertyId: string,
    roomCode: string,
    status: RoomStatus = RoomStatus.AVAILABLE
  ): Promise<string> {
    const room = await prismaSystem.room.create({
      data: {
        tenantId,
        propertyId,
        roomCode,
        areaM2: 20,
        basePrice: 3000000,
        status,
      },
    });
    return room.id;
  }

  function authPost(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/rooms').set('Authorization', `Bearer ${token}`).send(body);
  }

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
        password: process.env.SEED_ADMIN_PASSWORD || 'change_me',
      });
    adminToken = adminRes.body.data.token;

    const planNormal = await prismaSystem.plan.create({
      data: {
        name: `Gói Thường R ${ts}`,
        maxProperties: 5,
        maxRooms: 20,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planNormalId = planNormal.id;

    const planRoomLimit = await prismaSystem.plan.create({
      data: {
        name: `Gói Giới Hạn R ${ts}`,
        maxProperties: 5,
        maxRooms: 1,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planRoomLimitId = planRoomLimit.id;

    const a = await createTenantWithLandlord('Tenant R A', planNormalId, 'room.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;

    const renterEmail = `room.renter.a.${ts}@example.com`;
    const renter = await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: renterEmail,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: 'Renter R A',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    renterAId = renter.id;
    const renterLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: renterEmail, password: PASSWORD });
    renterAToken = renterLogin.body.data.token;

    propertyA1Id = await createProperty(tenantAId, `Nhà R A1 ${ts}`, true);
    propertyA2Id = await createProperty(tenantAId, `Nhà R A2 ${ts}`, true);
    propertyA3Id = await createProperty(tenantAId, `Nhà R A3 (ẩn) ${ts}`, false);

    // Phòng có hợp đồng ACTIVE
    roomActiveId = await createRoom(tenantAId, propertyA1Id, `ACT${ts}`, RoomStatus.OCCUPIED);
    const now = new Date();
    await prismaSystem.contract.create({
      data: {
        tenantId: tenantAId,
        roomId: roomActiveId,
        renterId: renterAId,
        startDate: now,
        endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        monthlyRent: 3000000,
        status: ContractStatus.ACTIVE,
      },
    });

    const b = await createTenantWithLandlord('Tenant R B', planNormalId, 'room.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;
    propertyBId = await createProperty(tenantBId, `Nhà R B1 ${ts}`, true);
    roomBId = await createRoom(tenantBId, propertyBId, `RB${ts}`);

    const rl = await createTenantWithLandlord('Tenant R Limit', planRoomLimitId, 'room.landlord.rl');
    tenantRoomLimitId = rl.tenantId;
    landlordRoomLimitToken = rl.token;
    propertyRL1Id = await createProperty(tenantRoomLimitId, `Nhà RL1 ${ts}`, true);
    propertyRL2Id = await createProperty(tenantRoomLimitId, `Nhà RL2 ${ts}`, true);
    const propertyRLHiddenId = await createProperty(tenantRoomLimitId, `Nhà RL ẩn ${ts}`, false);
    await createRoom(tenantRoomLimitId, propertyRLHiddenId, `RLH${ts}`);

    const conc = await createTenantWithLandlord('Tenant R Conc', planRoomLimitId, 'room.landlord.conc');
    tenantConcId = conc.tenantId;
    landlordConcToken = conc.token;
    propertyConcId = await createProperty(tenantConcId, `Nhà Conc ${ts}`, true);
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
    await cleanupTenant(tenantRoomLimitId);
    await cleanupTenant(tenantConcId);
    for (const planId of [planNormalId, planRoomLimitId]) {
      if (planId) {
        const used = await prismaSystem.tenant.findFirst({ where: { planId } });
        if (!used) await prismaSystem.plan.delete({ where: { id: planId } });
      }
    }
    await prismaSystem.$disconnect();
  });

  describe('Tạo phòng (POST)', () => {
    it('Tạo thành công mặc định AVAILABLE, basePrice là string', async () => {
      const res = await authPost(landlordAToken, {
        propertyId: propertyA1Id,
        roomCode: `NEW${ts}`,
        basePrice: 2500000,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(RoomStatus.AVAILABLE);
      expect(res.body.data.propertyId).toBe(propertyA1Id);
      expect(res.body.data.tenantId).toBe(tenantAId);
      expect(res.body.data.areaM2).toBeNull();
      expect(typeof res.body.data.basePrice).toBe('string');
      expect(Number(res.body.data.basePrice)).toBe(2500000);
    });

    it('Tạo kèm diện tích, areaM2 là string', async () => {
      const res = await authPost(landlordAToken, {
        propertyId: propertyA1Id,
        roomCode: `AREA${ts}`,
        areaM2: 25.5,
        basePrice: 3000000,
        description: 'Phòng có ban công',
      });

      expect(res.status).toBe(201);
      expect(typeof res.body.data.areaM2).toBe('string');
      expect(Number(res.body.data.areaM2)).toBe(25.5);
    });

    it('Trùng mã phòng trong cùng nhà trọ -> 409', async () => {
      const code = `DUP${ts}`;
      const first = await authPost(landlordAToken, {
        propertyId: propertyA1Id,
        roomCode: code,
        basePrice: 1000000,
      });
      expect(first.status).toBe(201);

      const second = await authPost(landlordAToken, {
        propertyId: propertyA1Id,
        roomCode: code,
        basePrice: 1000000,
      });
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('CONFLICT');
    });

    it('Cùng mã phòng ở nhà trọ khác -> OK', async () => {
      const code = `SHARED${ts}`;
      const p1 = await authPost(landlordAToken, {
        propertyId: propertyA1Id,
        roomCode: code,
        basePrice: 1000000,
      });
      expect(p1.status).toBe(201);

      const p2 = await authPost(landlordAToken, {
        propertyId: propertyA2Id,
        roomCode: code,
        basePrice: 1000000,
      });
      expect(p2.status).toBe(201);
    });

    it('propertyId thuộc Tenant khác -> 404', async () => {
      const res = await authPost(landlordAToken, {
        propertyId: propertyBId,
        roomCode: `CROSS${ts}`,
        basePrice: 1000000,
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });

    it('propertyId là nhà trọ đã ẩn -> 400 PROPERTY_INACTIVE (Q1)', async () => {
      const res = await authPost(landlordAToken, {
        propertyId: propertyA3Id,
        roomCode: `HID${ts}`,
        basePrice: 1000000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROPERTY_INACTIVE');
    });

    it('propertyId không tồn tại -> 404', async () => {
      const res = await authPost(landlordAToken, {
        propertyId: '00000000-0000-4000-8000-000000000000',
        roomCode: `NONE${ts}`,
        basePrice: 1000000,
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Liệt kê, lọc, xem chi tiết', () => {
    it('Lọc theo propertyId', async () => {
      const res = await request(app)
        .get('/api/rooms')
        .query({ propertyId: propertyA1Id })
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every((r: { propertyId: string }) => r.propertyId === propertyA1Id)
      ).toBe(true);
    });

    it('Lọc theo status=OCCUPIED thấy phòng có hợp đồng', async () => {
      const res = await request(app)
        .get('/api/rooms')
        .query({ propertyId: propertyA1Id, status: 'OCCUPIED' })
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((r: { id: string }) => r.id === roomActiveId)).toBe(true);
      expect(res.body.data.every((r: { status: string }) => r.status === 'OCCUPIED')).toBe(true);
    });

    it('Tìm kiếm theo mã phòng', async () => {
      const code = `FIND${ts}`;
      await authPost(landlordAToken, {
        propertyId: propertyA1Id,
        roomCode: code,
        basePrice: 1000000,
      });

      const res = await request(app)
        .get('/api/rooms')
        .query({ search: code })
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].roomCode).toBe(code);
    });

    it('Xem chi tiết phòng của mình -> 200', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomActiveId}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(roomActiveId);
    });

    it('Xem chi tiết phòng Tenant khác -> 404', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomBId}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('Cập nhật phòng (PATCH /:id)', () => {
    let editableRoomId = '';

    it('Chuẩn bị phòng để sửa', async () => {
      const res = await authPost(landlordAToken, {
        propertyId: propertyA1Id,
        roomCode: `EDIT${ts}`,
        areaM2: 18,
        basePrice: 2000000,
      });
      expect(res.status).toBe(201);
      editableRoomId = res.body.data.id;
    });

    it('Cập nhật nhiều trường', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${editableRoomId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ roomCode: `EDIT2${ts}`, areaM2: 22, basePrice: 2200000, description: 'Đã sửa' });

      expect(res.status).toBe(200);
      expect(res.body.data.roomCode).toBe(`EDIT2${ts}`);
      expect(Number(res.body.data.areaM2)).toBe(22);
      expect(Number(res.body.data.basePrice)).toBe(2200000);
      expect(res.body.data.description).toBe('Đã sửa');
    });

    it('Chuyển sang nhà trọ khác -> 200', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${editableRoomId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ propertyId: propertyA2Id });

      expect(res.status).toBe(200);
      expect(res.body.data.propertyId).toBe(propertyA2Id);
    });

    it('Chuyển sang nhà trọ đã ẩn -> 400 PROPERTY_INACTIVE (Q1)', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${editableRoomId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ propertyId: propertyA3Id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROPERTY_INACTIVE');
    });

    it('Chuyển sang nhà trọ Tenant khác -> 404', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${editableRoomId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ propertyId: propertyBId });

      expect(res.status).toBe(404);
    });

    it('Đổi mã phòng trùng trong nhà trọ đích -> 409', async () => {
      const code = `MOVE${ts}`;
      await authPost(landlordAToken, {
        propertyId: propertyA2Id,
        roomCode: code,
        basePrice: 1000000,
      });
      const other = await authPost(landlordAToken, {
        propertyId: propertyA1Id,
        roomCode: `MOVE2${ts}`,
        basePrice: 1000000,
      });

      const res = await request(app)
        .patch(`/api/rooms/${other.body.data.id}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ propertyId: propertyA2Id, roomCode: code });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Chỉ đổi propertyId khi phòng chưa có dữ liệu nghiệp vụ', () => {
    let contractRoomId = '';

    it('Phòng có hợp đồng ACTIVE -> 409 ROOM_HAS_CONTRACT', async () => {
      contractRoomId = await createRoom(tenantAId, propertyA1Id, `LOCK${ts}`);
      const now = new Date();
      await prismaSystem.contract.create({
        data: {
          tenantId: tenantAId,
          roomId: contractRoomId,
          renterId: renterAId,
          startDate: now,
          endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          monthlyRent: 3000000,
          status: ContractStatus.ACTIVE,
        },
      });

      const res = await request(app)
        .patch(`/api/rooms/${contractRoomId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ propertyId: propertyA2Id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ROOM_HAS_CONTRACT');

      const unchanged = await prismaSystem.room.findUnique({ where: { id: contractRoomId } });
      expect(unchanged?.propertyId).toBe(propertyA1Id);
    });

    it('Phòng có chỉ số điện nước -> 409 ROOM_HAS_METER_READING', async () => {
      const meterRoomId = await createRoom(tenantAId, propertyA1Id, `MTR${ts}`);
      await prismaSystem.meterReading.create({
        data: {
          tenantId: tenantAId,
          roomId: meterRoomId,
          billingMonth: new Date(Date.UTC(2026, 0, 1)),
          electricityIndex: 100,
          waterIndex: 50,
          electricityUsage: 30,
          waterUsage: 5,
        },
      });

      const res = await request(app)
        .patch(`/api/rooms/${meterRoomId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ propertyId: propertyA2Id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ROOM_HAS_METER_READING');
    });

    it('Phòng có hóa đơn -> 409 ROOM_HAS_INVOICE', async () => {
      const invoiceRoomId = await createRoom(tenantAId, propertyA1Id, `INV${ts}`);
      const now = new Date();
      const contract = await prismaSystem.contract.create({
        data: {
          tenantId: tenantAId,
          roomId: invoiceRoomId,
          renterId: renterAId,
          startDate: now,
          endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          monthlyRent: 3000000,
          status: ContractStatus.ACTIVE,
        },
      });
      const reading = await prismaSystem.meterReading.create({
        data: {
          tenantId: tenantAId,
          roomId: invoiceRoomId,
          billingMonth: new Date(Date.UTC(2026, 2, 1)),
          electricityIndex: 130,
          waterIndex: 55,
          electricityUsage: 30,
          waterUsage: 5,
        },
      });
      await prismaSystem.invoice.create({
        data: {
          tenantId: tenantAId,
          contractId: contract.id,
          meterReadingId: reading.id,
          billingMonth: new Date(Date.UTC(2026, 2, 1)),
          electricityUnitPrice: 3500,
          waterUnitPrice: 20000,
          rentAmount: 3000000,
          electricityAmount: 105000,
          waterAmount: 100000,
          totalAmount: 3205000,
          issueDate: new Date(Date.UTC(2026, 2, 1)),
          dueDate: new Date(Date.UTC(2026, 2, 5)),
        },
      });

      const res = await request(app)
        .patch(`/api/rooms/${invoiceRoomId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ propertyId: propertyA2Id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ROOM_HAS_INVOICE');
    });

    it('Phòng có hợp đồng vẫn sửa được trường khác (không đổi propertyId) -> 200', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${contractRoomId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ basePrice: 3500000, description: 'Đã tăng giá' });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.basePrice)).toBe(3500000);
      expect(res.body.data.propertyId).toBe(propertyA1Id);
    });
  });

  describe('Cập nhật trạng thái (PATCH /:id/status)', () => {
    let roomId = '';

    it('Chuẩn bị phòng không hợp đồng', async () => {
      const res = await authPost(landlordAToken, {
        propertyId: propertyA2Id,
        roomCode: `STAT${ts}`,
        basePrice: 1000000,
      });
      expect(res.status).toBe(201);
      roomId = res.body.data.id;
    });

    it('AVAILABLE <-> MAINTENANCE', async () => {
      const toMaintenance = await request(app)
        .patch(`/api/rooms/${roomId}/status`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ status: 'MAINTENANCE' });
      expect(toMaintenance.status).toBe(200);
      expect(toMaintenance.body.data.status).toBe('MAINTENANCE');

      const toAvailable = await request(app)
        .patch(`/api/rooms/${roomId}/status`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ status: 'AVAILABLE' });
      expect(toAvailable.status).toBe(200);
      expect(toAvailable.body.data.status).toBe(RoomStatus.AVAILABLE);
    });

    it('Không cho set OCCUPIED thủ công -> 400', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${roomId}/status`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ status: 'OCCUPIED' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Phòng có hợp đồng ACTIVE -> 409 ROOM_HAS_ACTIVE_CONTRACT', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${roomActiveId}/status`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ status: 'AVAILABLE' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ROOM_HAS_ACTIVE_CONTRACT');
    });
  });

  describe('Phân quyền (chốt 7)', () => {
    it('RENTER nhận 403', async () => {
      const get = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${renterAToken}`);
      expect(get.status).toBe(403);

      const post = await authPost(renterAToken, {
        propertyId: propertyA1Id,
        roomCode: `HACK${ts}`,
        basePrice: 1,
      });
      expect(post.status).toBe(403);
    });

    it('ADMIN nhận 403', async () => {
      const get = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(get.status).toBe(403);
    });
  });

  describe('Tenant bị tạm ngưng', () => {
    it('Mọi route trả 403 TENANT_SUSPENDED', async () => {
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.SUSPENDED },
      });

      const res = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('TENANT_SUSPENDED');

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.ACTIVE },
      });
    });
  });

  describe('Gói hết hạn (chốt 6)', () => {
    it('GET 200 nhưng POST 403 SUBSCRIPTION_EXPIRED', async () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      const get = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(get.status).toBe(200);

      const post = await authPost(landlordAToken, {
        propertyId: propertyA1Id,
        roomCode: `EXP${ts}`,
        basePrice: 1000000,
      });
      expect(post.status).toBe(403);
      expect(post.body.error.code).toBe('SUBSCRIPTION_EXPIRED');

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: future },
      });
    });
  });

  describe('Giới hạn gói maxRooms (chốt 1)', () => {
    it('Chỉ đếm phòng thuộc nhà trọ đang hoạt động', async () => {
      // propertyRLHidden đã có 1 phòng nhưng KHÔNG được đếm (nhà trọ đã ẩn).
      const first = await authPost(landlordRoomLimitToken, {
        propertyId: propertyRL1Id,
        roomCode: `RL1${ts}`,
        basePrice: 1000000,
      });
      expect(first.status).toBe(201);

      const second = await authPost(landlordRoomLimitToken, {
        propertyId: propertyRL2Id,
        roomCode: `RL2${ts}`,
        basePrice: 1000000,
      });
      expect(second.status).toBe(403);
      expect(second.body.error.code).toBe('PLAN_LIMIT_REACHED');

      // Ẩn nhà trọ RL1 (không có hợp đồng) -> phòng của nó không còn được đếm.
      const deactivate = await request(app)
        .patch(`/api/properties/${propertyRL1Id}/deactivate`)
        .set('Authorization', `Bearer ${landlordRoomLimitToken}`);
      expect(deactivate.status).toBe(200);

      const third = await authPost(landlordRoomLimitToken, {
        propertyId: propertyRL2Id,
        roomCode: `RL3${ts}`,
        basePrice: 1000000,
      });
      expect(third.status).toBe(201);
    });
  });

  describe('Đồng thời: hai POST song song không vượt giới hạn', () => {
    it('Chỉ một request thành công khi gói cho phép 1 phòng', async () => {
      const [c1, c2] = await Promise.all([
        authPost(landlordConcToken, {
          propertyId: propertyConcId,
          roomCode: `CC1${ts}`,
          basePrice: 1000000,
        }),
        authPost(landlordConcToken, {
          propertyId: propertyConcId,
          roomCode: `CC2${ts}`,
          basePrice: 1000000,
        }),
      ]);

      const statuses = [c1.status, c2.status].sort((x, y) => x - y);
      expect(statuses).toEqual([201, 403]);
    });
  });
});
