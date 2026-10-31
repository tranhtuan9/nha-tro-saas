import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
  SupportStatus,
  SupportType,
} from '@prisma/client';

const PASSWORD = 'Password123!';

describe('Module Phản ánh (UC20, UC33) — /api/support-requests', () => {
  const ts = Date.now();
  let planId = '';

  let tenantAId = '';
  let landlordAToken = '';
  let landlordAId = '';
  let propertyAId = '';
  let roomAId = '';

  let renterA1Id = '';
  let renterA1Token = '';
  let renterA2Id = '';
  let renterA2Token = '';
  // Renter có hợp đồng ACTIVE
  let renterActiveId = '';
  let renterActiveToken = '';

  let tenantBId = '';
  let landlordBToken = '';
  let renterBId = '';

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createTenantWithLandlord(name: string, key: string, expired = false) {
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const end = expired
      ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const tenant = await prismaSystem.tenant.create({
      data: { name, planId, status: TenantStatus.ACTIVE, subscriptionStart: start, subscriptionEnd: end },
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

  let codeSeq = 0;
  function newCode(prefix: string) {
    codeSeq += 1;
    return `${prefix}${ts}${codeSeq}`;
  }

  async function createPropertyDirect(tenantId: string, name: string) {
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

  async function createActiveContract(tenantId: string, roomId: string, renterId: string) {
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
        status: ContractStatus.ACTIVE,
      },
    });
    return contract.id;
  }

  async function seedSupportRequest(
    tenantId: string,
    renterId: string,
    overrides: Partial<{ type: SupportType; title: string; status: SupportStatus; response: string }> = {}
  ) {
    const row = await prismaSystem.supportRequest.create({
      data: {
        tenantId,
        renterId,
        type: overrides.type ?? SupportType.REPAIR,
        title: overrides.title ?? `Phản ánh ${newCode('t')}`,
        content: 'Nội dung phản ánh kiểm thử',
        status: overrides.status ?? SupportStatus.OPEN,
        response: overrides.response ?? null,
      },
    });
    return row.id;
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
        name: `Gói Phản ánh ${ts}`,
        maxProperties: 10,
        maxRooms: 200,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planId = plan.id;

    const a = await createTenantWithLandlord('Tenant PA A', 'support.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;
    landlordAId = a.userId;

    propertyAId = await createPropertyDirect(tenantAId, 'Nhà trọ A');
    roomAId = await createRoomDirect(tenantAId, propertyAId, newCode('PA'));

    const r1 = await createRenter(tenantAId, 'support.renter.a1');
    renterA1Id = r1.id;
    renterA1Token = r1.token;
    const r2 = await createRenter(tenantAId, 'support.renter.a2');
    renterA2Id = r2.id;
    renterA2Token = r2.token;

    const ra = await createRenter(tenantAId, 'support.renter.active');
    renterActiveId = ra.id;
    renterActiveToken = ra.token;
    await createActiveContract(tenantAId, roomAId, renterActiveId);

    const b = await createTenantWithLandlord('Tenant PA B', 'support.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;
    const rb = await createRenter(tenantBId, 'support.renter.b');
    renterBId = rb.id;
  });

  afterAll(async () => {
    const cleanupTenant = async (tenantId: string) => {
      if (!tenantId) return;
      await prismaSystem.supportRequest.deleteMany({ where: { tenantId } });
      await prismaSystem.notification.deleteMany({ where: { tenantId } });
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

  beforeEach(async () => {
    const ids = [tenantAId, tenantBId];
    await prismaSystem.supportRequest.deleteMany({ where: { tenantId: { in: ids } } });
    await prismaSystem.notification.deleteMany({ where: { tenantId: { in: ids } } });
  });

  describe('Phân quyền', () => {
    it('Thiếu token -> 401', async () => {
      expect((await request(app).get('/api/support-requests')).status).toBe(401);
    });

    it('ADMIN bị chặn -> 403', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
          password: process.env.SEED_ADMIN_PASSWORD || 'change_me',
        });
      const adminToken = login.body.data.token as string;
      expect((await request(app).get('/api/support-requests').set(auth(adminToken))).status).toBe(403);
    });

    it('LANDLORD không POST được -> 403', async () => {
      const res = await request(app)
        .post('/api/support-requests')
        .set(auth(landlordAToken))
        .send({ type: 'REPAIR', title: 'Test', content: 'Test' });
      expect(res.status).toBe(403);
    });

    it('RENTER không respond được -> 403', async () => {
      const id = await seedSupportRequest(tenantAId, renterActiveId);
      const res = await request(app)
        .patch(`/api/support-requests/${id}/respond`)
        .set(auth(renterActiveToken))
        .send({ status: 'RESOLVED', response: 'x' });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/support-requests (UC33)', () => {
    it('Renter có hợp đồng ACTIVE tạo thành công -> 201 OPEN', async () => {
      const res = await request(app)
        .post('/api/support-requests')
        .set(auth(renterActiveToken))
        .send({ type: 'REPAIR', title: 'Rò nước', content: 'Vòi nước bị rò ở phòng ngủ' });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('OPEN');
      expect(res.body.data.renterId).toBe(renterActiveId);
    });

    it('Tạo phản ánh sinh Notification NEW_SUPPORT_REQUEST cho Landlord', async () => {
      await request(app)
        .post('/api/support-requests')
        .set(auth(renterActiveToken))
        .send({ type: 'REPAIR', title: 'Điện hỏng', content: 'Mất điện cả tầng' });

      const notif = await prismaSystem.notification.findFirst({
        where: { tenantId: tenantAId, userId: landlordAId, type: 'NEW_SUPPORT_REQUEST' },
      });
      expect(notif).not.toBeNull();
    });

    it('Renter KHÔNG có hợp đồng ACTIVE -> 409 NO_ACTIVE_CONTRACT', async () => {
      const res = await request(app)
        .post('/api/support-requests')
        .set(auth(renterA1Token))
        .send({ type: 'REPAIR', title: 'Thử', content: 'Không có hợp đồng' });
      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('NO_ACTIVE_CONTRACT');
    });

    it('Dữ liệu sai (type/title/content) -> 400', async () => {
      const bad1 = await request(app)
        .post('/api/support-requests')
        .set(auth(renterActiveToken))
        .send({ type: 'INVALID', title: 'a', content: 'b' });
      expect(bad1.status).toBe(400);

      const bad2 = await request(app)
        .post('/api/support-requests')
        .set(auth(renterActiveToken))
        .send({ type: 'REPAIR', title: 'a'.repeat(151), content: 'b' });
      expect(bad2.status).toBe(400);

      const bad3 = await request(app)
        .post('/api/support-requests')
        .set(auth(renterActiveToken))
        .send({ type: 'REPAIR', title: 'a' });
      expect(bad3.status).toBe(400);
    });
  });

  describe('GET /api/support-requests', () => {
    it('Renter A không thấy phản ánh của Renter B cùng Tenant', async () => {
      await seedSupportRequest(tenantAId, renterActiveId, { title: 'Của Active' });
      await seedSupportRequest(tenantAId, renterA2Id, { title: 'Của A2' });

      const res = await request(app).get('/api/support-requests').set(auth(renterActiveToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Của Active');
    });

    it('Landlord thấy phản ánh của cả Tenant và lọc được theo renterId', async () => {
      await seedSupportRequest(tenantAId, renterActiveId);
      await seedSupportRequest(tenantAId, renterA2Id);

      const all = await request(app).get('/api/support-requests').set(auth(landlordAToken));
      expect(all.status).toBe(200);
      expect(all.body.data).toHaveLength(2);

      const filtered = await request(app)
        .get(`/api/support-requests?renterId=${renterA2Id}`)
        .set(auth(landlordAToken));
      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0].renterId).toBe(renterA2Id);
    });

    it('Lọc status/type và phân trang hoạt động', async () => {
      await seedSupportRequest(tenantAId, renterActiveId, { type: 'REPAIR', status: 'OPEN' });
      await seedSupportRequest(tenantAId, renterActiveId, { type: 'COMPLAINT', status: 'RESOLVED', response: 'x' });

      const byType = await request(app)
        .get('/api/support-requests?type=REPAIR')
        .set(auth(landlordAToken));
      expect(byType.body.data).toHaveLength(1);

      const paged = await request(app)
        .get('/api/support-requests?pageSize=1&page=1')
        .set(auth(landlordAToken));
      expect(paged.body.data).toHaveLength(1);
      expect(paged.body.pagination.total).toBe(2);
    });

    it('RLS: Landlord Tenant A không thấy phản ánh của Tenant B', async () => {
      await seedSupportRequest(tenantBId, renterBId, { title: 'Của B' });
      const res = await request(app).get('/api/support-requests').set(auth(landlordAToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/support-requests/:id', () => {
    it('Landlord chi tiết kèm renter + phòng ACTIVE, KHÔNG lộ email/SĐT/CCCD', async () => {
      const id = await seedSupportRequest(tenantAId, renterActiveId, { title: 'Chi tiết' });
      const res = await request(app).get(`/api/support-requests/${id}`).set(auth(landlordAToken));
      expect(res.status).toBe(200);
      expect(res.body.data.renter.fullName).toBeTruthy();
      expect(res.body.data.room.roomCode).toBeTruthy();
      expect(res.body.data.room.propertyName).toBeTruthy();
      expect(JSON.stringify(res.body.data)).not.toContain('@example.com');
      expect(res.body.data.renter).not.toHaveProperty('email');
      expect(res.body.data.renter).not.toHaveProperty('phone');
      expect(res.body.data.renter).not.toHaveProperty('nationalId');
    });

    it('Renter xem chi tiết phản ánh của chính mình -> 200 (có đủ nội dung/phản hồi)', async () => {
      const id = await seedSupportRequest(tenantAId, renterActiveId, {
        title: 'Phản ánh của chính mình',
        status: SupportStatus.IN_PROGRESS,
      });
      // Thêm response để xác nhận Renter cũng xem được phản hồi
      await prismaSystem.supportRequest.update({
        where: { id },
        data: { response: 'Đã ghi nhận, sẽ xử lý sớm', respondedAt: new Date() },
      });

      const res = await request(app).get(`/api/support-requests/${id}`).set(auth(renterActiveToken));
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.title).toBe('Phản ánh của chính mình');
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.content).toBeTruthy();
      expect(res.body.data.response).toBe('Đã ghi nhận, sẽ xử lý sớm');
      expect(res.body.data.respondedAt).toBeTruthy();
    });

    it('Renter truy cập phản ánh của người khác cùng Tenant -> 404', async () => {
      const id = await seedSupportRequest(tenantAId, renterA2Id);
      const res = await request(app).get(`/api/support-requests/${id}`).set(auth(renterActiveToken));
      expect(res.status).toBe(404);
    });

    it('Landlord Tenant khác -> 404; id sai định dạng -> 400', async () => {
      const id = await seedSupportRequest(tenantBId, renterBId);
      expect((await request(app).get(`/api/support-requests/${id}`).set(auth(landlordAToken))).status).toBe(404);
      expect((await request(app).get('/api/support-requests/not-a-uuid').set(auth(landlordAToken))).status).toBe(400);
    });
  });

  describe('PATCH /api/support-requests/:id/respond (UC20)', () => {
    it('Landlord đổi IN_PROGRESS + response -> 200, set respondedAt', async () => {
      const id = await seedSupportRequest(tenantAId, renterActiveId);
      const res = await request(app)
        .patch(`/api/support-requests/${id}/respond`)
        .set(auth(landlordAToken))
        .send({ status: 'IN_PROGRESS', response: 'Đã tiếp nhận' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.response).toBe('Đã tiếp nhận');
      expect(res.body.data.respondedAt).toBeTruthy();
    });

    it('RESOLVED thiếu response -> 400 RESPONSE_REQUIRED', async () => {
      const id = await seedSupportRequest(tenantAId, renterActiveId);
      const res = await request(app)
        .patch(`/api/support-requests/${id}/respond`)
        .set(auth(landlordAToken))
        .send({ status: 'RESOLVED' });
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('RESPONSE_REQUIRED');
    });

    it('RESOLVED rồi sửa tiếp -> 409 SUPPORT_REQUEST_CLOSED', async () => {
      const id = await seedSupportRequest(tenantAId, renterActiveId, {
        status: SupportStatus.RESOLVED,
        response: 'Xong',
      });
      const res = await request(app)
        .patch(`/api/support-requests/${id}/respond`)
        .set(auth(landlordAToken))
        .send({ status: 'IN_PROGRESS', response: 'Mở lại' });
      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('SUPPORT_REQUEST_CLOSED');
    });

    it('Idempotent: gửi lại đúng RESOLVED + cùng nội dung -> 200', async () => {
      const id = await seedSupportRequest(tenantAId, renterActiveId, {
        status: SupportStatus.RESOLVED,
        response: 'Đã xử lý',
      });
      const res = await request(app)
        .patch(`/api/support-requests/${id}/respond`)
        .set(auth(landlordAToken))
        .send({ status: 'RESOLVED', response: 'Đã xử lý' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESOLVED');
    });

    it('Respond sinh Notification SUPPORT_REQUEST_RESPONDED cho Renter', async () => {
      const id = await seedSupportRequest(tenantAId, renterActiveId);
      await request(app)
        .patch(`/api/support-requests/${id}/respond`)
        .set(auth(landlordAToken))
        .send({ status: 'IN_PROGRESS', response: 'Đã tiếp nhận' });

      const notif = await prismaSystem.notification.findFirst({
        where: { tenantId: tenantAId, userId: renterActiveId, type: 'SUPPORT_REQUEST_RESPONDED' },
      });
      expect(notif).not.toBeNull();
      expect(notif?.entityId).toBe(id);
    });

    it('Phản ánh Tenant khác -> 404; status sai/OPEN -> 400', async () => {
      const idB = await seedSupportRequest(tenantBId, renterBId);
      expect(
        (
          await request(app)
            .patch(`/api/support-requests/${idB}/respond`)
            .set(auth(landlordAToken))
            .send({ status: 'RESOLVED', response: 'x' })
        ).status
      ).toBe(404);

      const idA = await seedSupportRequest(tenantAId, renterActiveId);
      expect(
        (
          await request(app)
            .patch(`/api/support-requests/${idA}/respond`)
            .set(auth(landlordAToken))
            .send({ status: 'OPEN' })
        ).status
      ).toBe(400);
    });
  });

  describe('Tenant hết hạn (ngoại lệ Luật 12)', () => {
    let expiredRenterToken = '';
    let expiredRenterId = '';
    let expiredLandlordToken = '';
    let expiredTenantId = '';

    beforeAll(async () => {
      const t = await createTenantWithLandlord('Tenant PA Expired', 'support.landlord.expired', true);
      expiredTenantId = t.tenantId;
      expiredLandlordToken = t.token;

      const propertyId = await createPropertyDirect(expiredTenantId, 'Nhà trọ hết hạn');
      const roomId = await createRoomDirect(expiredTenantId, propertyId, newCode('PX'));
      const r = await createRenter(expiredTenantId, 'support.renter.expired');
      expiredRenterId = r.id;
      expiredRenterToken = r.token;
      await createActiveContract(expiredTenantId, roomId, expiredRenterId);
    });

    afterAll(async () => {
      if (!expiredTenantId) return;
      await prismaSystem.supportRequest.deleteMany({ where: { tenantId: expiredTenantId } });
      await prismaSystem.notification.deleteMany({ where: { tenantId: expiredTenantId } });
      await prismaSystem.contract.deleteMany({ where: { tenantId: expiredTenantId } });
      await prismaSystem.room.deleteMany({ where: { tenantId: expiredTenantId } });
      await prismaSystem.property.deleteMany({ where: { tenantId: expiredTenantId } });
      await prismaSystem.user.deleteMany({ where: { tenantId: expiredTenantId } });
      await prismaSystem.tenant.delete({ where: { id: expiredTenantId } });
    });

    it('Renter vẫn gửi được khi Tenant hết hạn -> 201', async () => {
      const res = await request(app)
        .post('/api/support-requests')
        .set(auth(expiredRenterToken))
        .send({ type: 'OTHER', title: 'Sự cố', content: 'Báo sự cố dù gói hết hạn' });
      expect(res.status).toBe(201);
    });

    it('Landlord vẫn respond được khi Tenant hết hạn -> 200', async () => {
      const id = await seedSupportRequest(expiredTenantId, expiredRenterId);
      const res = await request(app)
        .patch(`/api/support-requests/${id}/respond`)
        .set(auth(expiredLandlordToken))
        .send({ status: 'IN_PROGRESS', response: 'Đã tiếp nhận' });
      expect(res.status).toBe(200);
    });
  });
});
