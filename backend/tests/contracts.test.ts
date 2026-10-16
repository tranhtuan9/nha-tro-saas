import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import {
  UserRole,
  UserStatus,
  TenantStatus,
  RoomStatus,
  ContractStatus,
} from '@prisma/client';

const PASSWORD = 'Password123!';

describe('Module Hợp đồng (UC15) — /api/contracts', () => {
  const ts = Date.now();
  let planNormalId = '';

  let tenantAId = '';
  let landlordAToken = '';
  let landlordAId = '';
  let renterA1Id = '';
  let renterA2Id = '';
  let propertyA1Id = '';
  let propertyA2Id = '';

  // Phòng của Tenant A
  const rooms: Record<string, string> = {};
  // Hợp đồng có sẵn (fixture) cho test lọc theo status
  let contractEndedFixtureId = '';
  let contractTerminatedFixtureId = '';

  let tenantBId = '';
  let landlordBToken = '';
  let renterB1Id = '';
  let propertyBId = '';
  let roomBId = '';
  let contractBId = '';

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
    return {
      tenantId: tenant.id,
      landlordId: landlord.id,
      email,
      token: login.body.data.token as string,
    };
  }

  async function createRenterDirect(tenantId: string, key: string): Promise<string> {
    const renter = await prismaSystem.user.create({
      data: {
        tenantId,
        email: `${key}.${ts}@example.com`,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: `Người thuê ${key}`,
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    return renter.id;
  }

  async function createPropertyDirect(tenantId: string, name: string): Promise<string> {
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

  async function createRoomDirect(tenantId: string, propertyId: string, roomCode: string) {
    const room = await prismaSystem.room.create({
      data: {
        tenantId,
        propertyId,
        roomCode,
        areaM2: 20,
        basePrice: 3000000,
        status: RoomStatus.AVAILABLE,
      },
    });
    return room.id;
  }

  async function createContractDirect(
    tenantId: string,
    roomId: string,
    renterId: string,
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
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
        ...overrides,
      },
    });
    return contract.id;
  }

  function authPost(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/contracts').set('Authorization', `Bearer ${token}`).send(body);
  }

  function authPatch(token: string, url: string, body?: Record<string, unknown>) {
    return request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body ?? {});
  }

  async function getRoomStatus(roomId: string): Promise<string> {
    const room = await prismaSystem.room.findUnique({ where: { id: roomId } });
    return room!.status;
  }

  async function getContractStatus(contractId: string): Promise<string> {
    const contract = await prismaSystem.contract.findUnique({ where: { id: contractId } });
    return contract!.status;
  }

  function newCode(prefix: string): string {
    return `${prefix}${ts}${Math.floor(Math.random() * 1000)}`;
  }

  beforeAll(async () => {
    const plan = await prismaSystem.plan.create({
      data: {
        name: `Gói Thường HD ${ts}`,
        maxProperties: 10,
        maxRooms: 100,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planNormalId = plan.id;

    const a = await createTenantWithLandlord('Tenant HD A', planNormalId, 'contract.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;
    landlordAId = a.landlordId;

    const b = await createTenantWithLandlord('Tenant HD B', planNormalId, 'contract.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;

    renterA1Id = await createRenterDirect(tenantAId, 'contract.renter.a1');
    renterA2Id = await createRenterDirect(tenantAId, 'contract.renter.a2');
    renterB1Id = await createRenterDirect(tenantBId, 'contract.renter.b1');

    propertyA1Id = await createPropertyDirect(tenantAId, `Nhà HD A1 ${ts}`);
    propertyA2Id = await createPropertyDirect(tenantAId, `Nhà HD A2 ${ts}`);
    propertyBId = await createPropertyDirect(tenantBId, `Nhà HD B1 ${ts}`);

    // Mỗi test dùng một phòng riêng để không đè trạng thái lên nhau.
    for (const code of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11']) {
      rooms[code] = await createRoomDirect(tenantAId, propertyA1Id, newCode(code));
    }
    rooms['A2P'] = await createRoomDirect(tenantAId, propertyA2Id, newCode('A2P'));
    roomBId = await createRoomDirect(tenantBId, propertyBId, newCode('B1'));

    // Fixture hợp đồng ENDED / TERMINATED (không chiếm phòng) cho test lọc status.
    const roomEnded = await createRoomDirect(tenantAId, propertyA1Id, newCode('ENDD'));
    const roomTerminated = await createRoomDirect(tenantAId, propertyA1Id, newCode('TERMD'));
    contractEndedFixtureId = await createContractDirect(tenantAId, roomEnded, renterA1Id, {
      status: ContractStatus.ENDED,
    });
    contractTerminatedFixtureId = await createContractDirect(tenantAId, roomTerminated, renterA2Id, {
      status: ContractStatus.TERMINATED,
      terminatedReason: 'Fixture chấm dứt',
    });

    // Hợp đồng của Tenant B cho test cross-tenant.
    contractBId = await createContractDirect(tenantBId, roomBId, renterB1Id);
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
    if (planNormalId) {
      const used = await prismaSystem.tenant.findFirst({ where: { planId: planNormalId } });
      if (!used) await prismaSystem.plan.delete({ where: { id: planNormalId } });
    }
    await prismaSystem.$disconnect();
  });

  describe('Tạo hợp đồng (POST)', () => {
    let contractA1Id = '';

    it('Tạo thành công 201: status ACTIVE, Decimal trả string, Room -> OCCUPIED', async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A1'],
        renterId: renterA1Id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        monthlyRent: 3500000,
        deposit: 7000000,
        terms: 'Không nuôi thú cưng',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(ContractStatus.ACTIVE);
      expect(res.body.data.tenantId).toBe(tenantAId);
      expect(res.body.data.roomId).toBe(rooms['A1']);
      expect(res.body.data.renterId).toBe(renterA1Id);
      expect(typeof res.body.data.monthlyRent).toBe('string');
      expect(typeof res.body.data.deposit).toBe('string');
      expect(Number(res.body.data.monthlyRent)).toBe(3500000);
      contractA1Id = res.body.data.id;

      expect(await getRoomStatus(rooms['A1'])).toBe(RoomStatus.OCCUPIED);
    });

    it('Q1: startDate ở quá khứ vẫn được chấp nhận', async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A2'],
        renterId: renterA1Id,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(ContractStatus.ACTIVE);
    });

    it('endDate <= startDate -> 400 INVALID_DATE_RANGE', async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A3'],
        renterId: renterA1Id,
        startDate: '2026-01-01',
        endDate: '2026-01-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
      expect(await getRoomStatus(rooms['A3'])).toBe(RoomStatus.AVAILABLE);
    });

    it('Phòng đã có hợp đồng ACTIVE -> 409 ROOM_ALREADY_OCCUPIED', async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A1'],
        renterId: renterA2Id,
        startDate: '2026-02-01',
        endDate: '2027-02-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ROOM_ALREADY_OCCUPIED');
    });

    it('renterId là Landlord -> 400 INVALID_RENTER', async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A3'],
        renterId: landlordAId,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RENTER');
    });

    it('renterId không tồn tại -> 400 INVALID_RENTER', async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A3'],
        renterId: '00000000-0000-4000-8000-000000000000',
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RENTER');
    });

    it('renterId thuộc Tenant khác -> 400 INVALID_RENTER', async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A3'],
        renterId: renterB1Id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RENTER');
    });

    it('roomId thuộc Tenant khác -> 404 ROOM_NOT_FOUND', async () => {
      const res = await authPost(landlordAToken, {
        roomId: roomBId,
        renterId: renterA1Id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    });

    it('Phòng đang MAINTENANCE -> 409 ROOM_NOT_AVAILABLE', async () => {
      const roomId = await createRoomDirect(tenantAId, propertyA1Id, newCode('MNT'));
      await prismaSystem.room.update({
        where: { id: roomId },
        data: { status: RoomStatus.MAINTENANCE },
      });

      const res = await authPost(landlordAToken, {
        roomId,
        renterId: renterA1Id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ROOM_NOT_AVAILABLE');
      // Phòng giữ nguyên trạng thái, không bị đổi sang OCCUPIED.
      expect(await getRoomStatus(roomId)).toBe(RoomStatus.MAINTENANCE);
    });

    it('Nhà trọ của phòng đã ẩn -> 400 PROPERTY_INACTIVE', async () => {
      const hiddenPropertyId = await createPropertyDirect(tenantAId, `Nhà Ẩn HD ${ts}`);
      await prismaSystem.property.update({
        where: { id: hiddenPropertyId },
        data: { isActive: false },
      });
      const roomId = await createRoomDirect(tenantAId, hiddenPropertyId, newCode('INACT'));

      const res = await authPost(landlordAToken, {
        roomId,
        renterId: renterA1Id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROPERTY_INACTIVE');
      expect(await getRoomStatus(roomId)).toBe(RoomStatus.AVAILABLE);
    });

    it('Thiếu roomId -> 400 VALIDATION_ERROR', async () => {
      const res = await authPost(landlordAToken, {
        renterId: renterA1Id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('deposit mặc định 0 khi không truyền', async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A4'],
        renterId: renterA2Id,
        startDate: '2026-03-01',
        endDate: '2027-03-01',
        monthlyRent: 4000000,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.deposit).toBe('0');
    });
  });

  describe('Danh sách & lọc (GET)', () => {
    it('Trả 200 kèm pagination', async () => {
      const res = await request(app)
        .get('/api/contracts?page=1&pageSize=100')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 100 });
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(typeof res.body.data[0].monthlyRent).toBe('string');
    });

    it('Lọc theo roomId', async () => {
      const res = await request(app)
        .get(`/api/contracts?roomId=${rooms['A1']}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].roomId).toBe(rooms['A1']);
    });

    it('Lọc theo renterId', async () => {
      const res = await request(app)
        .get(`/api/contracts?renterId=${renterA2Id}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((c: { renterId: string }) => c.renterId === renterA2Id)).toBe(
        true
      );
    });

    it('Lọc theo propertyId', async () => {
      const res = await request(app)
        .get(`/api/contracts?propertyId=${propertyA1Id}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      const resOther = await request(app)
        .get('/api/contracts?propertyId=00000000-0000-4000-8000-000000000111')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(resOther.status).toBe(200);
      expect(resOther.body.data.length).toBe(0);
    });

    it('Lọc theo status: ENDED và TERMINATED trả đúng fixture', async () => {
      const ended = await request(app)
        .get('/api/contracts?status=ENDED')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(ended.status).toBe(200);
      expect(
        ended.body.data.some((c: { id: string }) => c.id === contractEndedFixtureId)
      ).toBe(true);

      const terminated = await request(app)
        .get('/api/contracts?status=TERMINATED')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(terminated.status).toBe(200);
      expect(
        terminated.body.data.some((c: { id: string }) => c.id === contractTerminatedFixtureId)
      ).toBe(true);
    });
  });

  describe('Chi tiết (GET /:id)', () => {
    let detailContractId = '';

    beforeAll(async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A5'],
        renterId: renterA1Id,
        startDate: '2026-04-01',
        endDate: '2027-04-01',
        monthlyRent: 4500000,
        deposit: 9000000,
      });
      expect(res.status).toBe(201);
      detailContractId = res.body.data.id;
    });

    it('Q2: trả kèm room phẳng (propertyId + propertyName) và renter an toàn', async () => {
      const res = await request(app)
        .get(`/api/contracts/${detailContractId}`)
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.room.id).toBe(rooms['A5']);
      expect(data.room.roomCode).toBeTruthy();
      expect(data.room.propertyId).toBe(propertyA1Id);
      expect(data.room.propertyName).toBeTruthy();
      expect(data.room.property).toBeUndefined();

      expect(data.renter.id).toBe(renterA1Id);
      expect(data.renter.fullName).toBeTruthy();
      expect(data.renter.email).toBeTruthy();
      expect(data.renter.phone !== undefined).toBe(true);
      expect(data.renter.passwordHash).toBeUndefined();
      expect(data.renter.nationalId).toBeUndefined();
      expect(data.renter.role).toBeUndefined();

      expect(typeof data.monthlyRent).toBe('string');
      expect(typeof data.deposit).toBe('string');
      expect(data.startDate.slice(0, 10)).toBe('2026-04-01');
      expect(data.endDate.slice(0, 10)).toBe('2027-04-01');
    });

    it('Hợp đồng của Tenant khác -> 404 CONTRACT_NOT_FOUND', async () => {
      const res = await request(app)
        .get(`/api/contracts/${contractBId}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CONTRACT_NOT_FOUND');
    });
  });

  describe('Sửa hợp đồng (PATCH /:id)', () => {
    let patchContractId = '';

    beforeAll(async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A6'],
        renterId: renterA1Id,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(201);
      patchContractId = res.body.data.id;
    });

    it('Sửa endDate/monthlyRent/deposit/terms thành công', async () => {
      const res = await authPatch(landlordAToken, `/api/contracts/${patchContractId}`, {
        endDate: '2027-06-30',
        monthlyRent: 3800000,
        deposit: 5000000,
        terms: 'Điều khoản mới',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.endDate.slice(0, 10)).toBe('2027-06-30');
      expect(res.body.data.monthlyRent).toBe('3800000');
      expect(res.body.data.deposit).toBe('5000000');
      expect(res.body.data.terms).toBe('Điều khoản mới');
      expect(res.body.data.roomId).toBe(rooms['A6']);
    });

    it('endDate <= startDate hiện tại -> 400 INVALID_DATE_RANGE', async () => {
      const res = await authPatch(landlordAToken, `/api/contracts/${patchContractId}`, {
        endDate: '2026-01-01',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('Không truyền trường nào -> 400 VALIDATION_ERROR', async () => {
      const res = await authPatch(landlordAToken, `/api/contracts/${patchContractId}`, {});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Hợp đồng ENDED -> 409 CONTRACT_NOT_ACTIVE', async () => {
      const res = await authPatch(landlordAToken, `/api/contracts/${contractEndedFixtureId}`, {
        monthlyRent: 1234567,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONTRACT_NOT_ACTIVE');
    });

    it('Hợp đồng của Tenant khác -> 404 CONTRACT_NOT_FOUND', async () => {
      const res = await authPatch(landlordAToken, `/api/contracts/${contractBId}`, {
        monthlyRent: 1,
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CONTRACT_NOT_FOUND');
    });
  });

  describe('Chấm dứt hợp đồng (PATCH /:id/terminate)', () => {
    let terminateContractId = '';

    beforeAll(async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A7'],
        renterId: renterA1Id,
        startDate: '2026-05-01',
        endDate: '2027-05-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(201);
      terminateContractId = res.body.data.id;
    });

    it('Terminate 200: TERMINATED + lưu reason + Room -> AVAILABLE (cùng transaction)', async () => {
      const res = await authPatch(
        landlordAToken,
        `/api/contracts/${terminateContractId}/terminate`,
        { reason: 'Người thuê vi phạm nội quy' }
      );

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ContractStatus.TERMINATED);
      expect(res.body.data.terminatedReason).toBe('Người thuê vi phạm nội quy');

      expect(await getContractStatus(terminateContractId)).toBe(ContractStatus.TERMINATED);
      expect(await getRoomStatus(rooms['A7'])).toBe(RoomStatus.AVAILABLE);
    });

    it('Gọi terminate lần hai -> 409 CONTRACT_NOT_ACTIVE', async () => {
      const res = await authPatch(
        landlordAToken,
        `/api/contracts/${terminateContractId}/terminate`,
        { reason: 'Gọi lại' }
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONTRACT_NOT_ACTIVE');
    });

    it('Terminate không truyền body -> 200, terminatedReason = null', async () => {
      const created = await authPost(landlordAToken, {
        roomId: rooms['A8'],
        renterId: renterA2Id,
        startDate: '2026-06-01',
        endDate: '2027-06-01',
        monthlyRent: 3000000,
      });
      expect(created.status).toBe(201);

      const res = await authPatch(
        landlordAToken,
        `/api/contracts/${created.body.data.id}/terminate`
      );
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ContractStatus.TERMINATED);
      expect(res.body.data.terminatedReason).toBeNull();
      expect(await getRoomStatus(rooms['A8'])).toBe(RoomStatus.AVAILABLE);
    });

    it('Hợp đồng của Tenant khác -> 404 CONTRACT_NOT_FOUND', async () => {
      const res = await authPatch(
        landlordAToken,
        `/api/contracts/${contractBId}/terminate`,
        { reason: 'Hack' }
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CONTRACT_NOT_FOUND');
    });
  });

  describe('Kết thúc hợp đồng (PATCH /:id/end)', () => {
    let endContractId = '';

    beforeAll(async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A9'],
        renterId: renterA1Id,
        startDate: '2026-07-01',
        endDate: '2027-07-01',
        monthlyRent: 3200000,
      });
      expect(res.status).toBe(201);
      endContractId = res.body.data.id;
    });

    it('End 200: ENDED + Room -> AVAILABLE (cùng transaction)', async () => {
      const res = await authPatch(landlordAToken, `/api/contracts/${endContractId}/end`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ContractStatus.ENDED);

      expect(await getContractStatus(endContractId)).toBe(ContractStatus.ENDED);
      expect(await getRoomStatus(rooms['A9'])).toBe(RoomStatus.AVAILABLE);
    });

    it('Gọi end lần hai -> 409 CONTRACT_NOT_ACTIVE', async () => {
      const res = await authPatch(landlordAToken, `/api/contracts/${endContractId}/end`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONTRACT_NOT_ACTIVE');
    });
  });

  describe('Phân quyền & trạng thái Tenant', () => {
    it('RENTER gọi API -> 403 FORBIDDEN', async () => {
      const renterLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: `contract.renter.a1.${ts}@example.com`, password: PASSWORD });
      expect(renterLogin.status).toBe(200);

      const res = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${renterLogin.body.data.token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('ADMIN gọi API -> 403 FORBIDDEN', async () => {
      const adminLogin = await request(app).post('/api/auth/login').send({
        email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
        password: process.env.SEED_ADMIN_PASSWORD || 'change_me',
      });
      expect(adminLogin.status).toBe(200);

      const res = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${adminLogin.body.data.token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Tenant SUSPENDED -> 403 TENANT_SUSPENDED', async () => {
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.SUSPENDED },
      });

      const res = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('TENANT_SUSPENDED');

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.ACTIVE },
      });
    });
  });

  describe('Hết hạn gói dịch vụ', () => {
    let expiredContract1Id = '';
    let expiredContract2Id = '';

    beforeAll(async () => {
      // Hai hợp đồng ACTIVE tạo trước khi hết hạn để test terminate/end khi hết hạn.
      const c1 = await authPost(landlordAToken, {
        roomId: rooms['A10'],
        renterId: renterA1Id,
        startDate: '2026-08-01',
        endDate: '2027-08-01',
        monthlyRent: 3000000,
      });
      const c2 = await authPost(landlordAToken, {
        roomId: rooms['A11'],
        renterId: renterA2Id,
        startDate: '2026-09-01',
        endDate: '2027-09-01',
        monthlyRent: 3000000,
      });
      expect(c1.status).toBe(201);
      expect(c2.status).toBe(201);
      expiredContract1Id = c1.body.data.id;
      expiredContract2Id = c2.body.data.id;

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
    });

    afterAll(async () => {
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
    });

    it('GET vẫn 200 khi hết hạn', async () => {
      const res = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(200);
    });

    it('POST -> 403 SUBSCRIPTION_EXPIRED khi hết hạn', async () => {
      const res = await authPost(landlordAToken, {
        roomId: rooms['A3'],
        renterId: renterA1Id,
        startDate: '2027-01-01',
        endDate: '2028-01-01',
        monthlyRent: 3000000,
      });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SUBSCRIPTION_EXPIRED');
    });

    it('Terminate khi hết hạn -> vẫn 200', async () => {
      const res = await authPatch(
        landlordAToken,
        `/api/contracts/${expiredContract1Id}/terminate`,
        { reason: 'Hết hạn gói' }
      );
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ContractStatus.TERMINATED);
    });

    it('End khi hết hạn -> vẫn 200', async () => {
      const res = await authPatch(
        landlordAToken,
        `/api/contracts/${expiredContract2Id}/end`
      );
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ContractStatus.ENDED);
    });
  });
});
