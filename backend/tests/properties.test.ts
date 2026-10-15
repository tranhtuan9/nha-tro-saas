import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { UserRole, UserStatus, TenantStatus, ContractStatus, RoomStatus } from '@prisma/client';

const PASSWORD = 'Password123!';

describe('Module Nhà trọ (UC12) — /api/properties', () => {
  const ts = Date.now();
  let adminToken = '';
  let planNormalId = '';
  let planLimitId = '';

  let tenantAId = '';
  let landlordAToken = '';
  let renterAToken = '';
  let renterAId = '';

  let tenantBId = '';
  let landlordBToken = '';

  let tenantLimitId = '';
  let landlordLimitToken = '';

  let tenantConcId = '';
  let landlordConcToken = '';

  let propertyAId = '';
  let propertyContractId = '';

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

  function authPost(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/properties').set('Authorization', `Bearer ${token}`).send(body);
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
        name: `Gói Thường P ${ts}`,
        maxProperties: 5,
        maxRooms: 20,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planNormalId = planNormal.id;

    const planLimit = await prismaSystem.plan.create({
      data: {
        name: `Gói Giới Hạn P ${ts}`,
        maxProperties: 1,
        maxRooms: 5,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planLimitId = planLimit.id;

    const a = await createTenantWithLandlord('Tenant P A', planNormalId, 'prop.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;

    const renterEmail = `prop.renter.a.${ts}@example.com`;
    const renter = await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: renterEmail,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: 'Renter P A',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    renterAId = renter.id;
    const renterLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: renterEmail, password: PASSWORD });
    renterAToken = renterLogin.body.data.token;

    const b = await createTenantWithLandlord('Tenant P B', planNormalId, 'prop.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;

    const limit = await createTenantWithLandlord('Tenant P Limit', planLimitId, 'prop.landlord.limit');
    tenantLimitId = limit.tenantId;
    landlordLimitToken = limit.token;

    const conc = await createTenantWithLandlord('Tenant P Conc', planLimitId, 'prop.landlord.conc');
    tenantConcId = conc.tenantId;
    landlordConcToken = conc.token;

    const resA = await authPost(landlordAToken, {
      name: `Nhà trọ A ${ts}`,
      address: '1 Đường A',
      electricityUnitPrice: 3500,
      waterUnitPrice: 20000,
    });
    propertyAId = resA.body.data.id;

    const resC = await authPost(landlordAToken, {
      name: `Nhà trọ Hợp Đồng ${ts}`,
      address: '2 Đường A',
      electricityUnitPrice: 3500,
      waterUnitPrice: 20000,
    });
    propertyContractId = resC.body.data.id;

    // Phòng + hợp đồng ACTIVE để kiểm thử chặn ẩn nhà trọ (chốt 5)
    const room = await prismaSystem.room.create({
      data: {
        tenantId: tenantAId,
        propertyId: propertyContractId,
        roomCode: 'C101',
        basePrice: 3000000,
        status: RoomStatus.OCCUPIED,
      },
    });
    const now = new Date();
    await prismaSystem.contract.create({
      data: {
        tenantId: tenantAId,
        roomId: room.id,
        renterId: renterAId,
        startDate: now,
        endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        monthlyRent: 3000000,
        status: ContractStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    const cleanupTenant = async (tenantId: string) => {
      if (!tenantId) return;
      await prismaSystem.contract.deleteMany({ where: { tenantId } });
      await prismaSystem.room.deleteMany({ where: { tenantId } });
      await prismaSystem.property.deleteMany({ where: { tenantId } });
      await prismaSystem.user.deleteMany({ where: { tenantId } });
      await prismaSystem.tenant.delete({ where: { id: tenantId } });
    };
    await cleanupTenant(tenantAId);
    await cleanupTenant(tenantBId);
    await cleanupTenant(tenantLimitId);
    await cleanupTenant(tenantConcId);
    for (const planId of [planNormalId, planLimitId]) {
      if (planId) {
        const used = await prismaSystem.tenant.findFirst({ where: { planId } });
        if (!used) await prismaSystem.plan.delete({ where: { id: planId } });
      }
    }
    await prismaSystem.$disconnect();
  });

  describe('Tạo nhà trọ (POST)', () => {
    it('Tạo thành công 201, isActive=true, giá Decimal trả dạng string', async () => {
      const res = await authPost(landlordAToken, {
        name: `Nhà trọ mới ${ts}`,
        address: '3 Đường Mới',
        description: 'Ghi chú',
        electricityUnitPrice: 4000,
        waterUnitPrice: 25000,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.tenantId).toBe(tenantAId);
      expect(res.body.data.isActive).toBe(true);
      expect(typeof res.body.data.electricityUnitPrice).toBe('string');
      expect(Number(res.body.data.electricityUnitPrice)).toBe(4000);
      expect(typeof res.body.data.waterUnitPrice).toBe('string');
      expect(Number(res.body.data.waterUnitPrice)).toBe(25000);
    });

    it('Trả 400 khi dữ liệu không hợp lệ (Zod)', async () => {
      const res = await authPost(landlordAToken, { name: 'A' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Liệt kê, phân trang, tìm kiếm (GET)', () => {
    it('Trả { data: [...], pagination }', async () => {
      const res = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20 });
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('Phân trang pageSize=1', async () => {
      const res = await request(app)
        .get('/api/properties')
        .query({ page: 1, pageSize: 1 })
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.pageSize).toBe(1);
    });

    it('Tìm kiếm theo tên (không phân biệt hoa thường)', async () => {
      await authPost(landlordAToken, {
        name: `Nhà trọ Hoa Hồng ${ts}`,
        address: '4 Đường Hoa',
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
      });

      const res = await request(app)
        .get('/api/properties')
        .query({ search: 'hoa hồng' })
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every((p: { name: string }) => p.name.toLowerCase().includes('hoa hồng'))
      ).toBe(true);
    });
  });

  describe('Xem chi tiết (GET /:id)', () => {
    it('Trả chi tiết, KHÔNG lồng rooms (Q4)', async () => {
      const res = await request(app)
        .get(`/api/properties/${propertyAId}`)
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(propertyAId);
      expect(res.body.data).not.toHaveProperty('rooms');
    });
  });

  describe('Cập nhật (PATCH /:id)', () => {
    it('Cập nhật tên và đơn giá', async () => {
      const res = await request(app)
        .patch(`/api/properties/${propertyAId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ name: `Nhà trọ A đổi tên ${ts}`, electricityUnitPrice: 5000 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(`Nhà trọ A đổi tên ${ts}`);
      expect(Number(res.body.data.electricityUnitPrice)).toBe(5000);
      // Không nhận isActive để kích hoạt lại
      expect(res.body.data.isActive).toBe(true);
    });

    it('Trả 400 khi body rỗng', async () => {
      const res = await request(app)
        .patch(`/api/properties/${propertyAId}`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('Ẩn nhà trọ (PATCH /:id/deactivate)', () => {
    it('Ẩn thành công, gọi lại idempotent trả 200 (chốt 4)', async () => {
      const first = await request(app)
        .patch(`/api/properties/${propertyAId}/deactivate`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(first.status).toBe(200);
      expect(first.body.data.isActive).toBe(false);

      const second = await request(app)
        .patch(`/api/properties/${propertyAId}/deactivate`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(second.status).toBe(200);
      expect(second.body.data.isActive).toBe(false);
    });

    it('Lọc isActive=false thấy nhà trọ đã ẩn', async () => {
      const res = await request(app)
        .get('/api/properties')
        .query({ isActive: 'false' })
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((p: { id: string }) => p.id === propertyAId)).toBe(true);
    });

    it('Trả 409 khi nhà trọ có hợp đồng ACTIVE (chốt 5)', async () => {
      const res = await request(app)
        .patch(`/api/properties/${propertyContractId}/deactivate`)
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PROPERTY_HAS_ACTIVE_CONTRACT');
    });
  });

  describe('Cách ly Tenant (Landlord B không thấy dữ liệu Tenant A)', () => {
    it('GET /:id của Tenant A -> 404', async () => {
      const res = await request(app)
        .get(`/api/properties/${propertyContractId}`)
        .set('Authorization', `Bearer ${landlordBToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });

    it('PATCH /:id của Tenant A -> 404', async () => {
      const res = await request(app)
        .patch(`/api/properties/${propertyContractId}`)
        .set('Authorization', `Bearer ${landlordBToken}`)
        .send({ name: 'Đổi trộm' });
      expect(res.status).toBe(404);
    });

    it('deactivate của Tenant A -> 404', async () => {
      const res = await request(app)
        .patch(`/api/properties/${propertyContractId}/deactivate`)
        .set('Authorization', `Bearer ${landlordBToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Phân quyền (chốt 7)', () => {
    it('RENTER nhận 403', async () => {
      const get = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${renterAToken}`);
      expect(get.status).toBe(403);

      const post = await authPost(renterAToken, {
        name: 'Gian lận',
        address: 'Đường X',
        electricityUnitPrice: 1,
        waterUnitPrice: 1,
      });
      expect(post.status).toBe(403);
    });

    it('ADMIN nhận 403', async () => {
      const get = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(get.status).toBe(403);

      const post = await authPost(adminToken, {
        name: 'Admin tạo',
        address: 'Đường A',
        electricityUnitPrice: 1,
        waterUnitPrice: 1,
      });
      expect(post.status).toBe(403);
    });
  });

  describe('Tenant bị tạm ngưng', () => {
    it('Mọi route trả 403 TENANT_SUSPENDED', async () => {
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.SUSPENDED },
      });

      const res = await request(app)
        .get('/api/properties')
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
        .get('/api/properties')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(get.status).toBe(200);

      const post = await authPost(landlordAToken, {
        name: 'Khi hết hạn',
        address: 'Đường Z',
        electricityUnitPrice: 1,
        waterUnitPrice: 1,
      });
      expect(post.status).toBe(403);
      expect(post.body.error.code).toBe('SUBSCRIPTION_EXPIRED');

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: future },
      });
    });
  });

  describe('Giới hạn gói maxProperties (chốt 1)', () => {
    it('Vượt giới hạn trả 403, ẩn bớt thì tạo được (chỉ đếm nhà trọ đang hoạt động)', async () => {
      const first = await authPost(landlordLimitToken, {
        name: `Limit 1 ${ts}`,
        address: 'L1',
        electricityUnitPrice: 1,
        waterUnitPrice: 1,
      });
      expect(first.status).toBe(201);
      const firstId = first.body.data.id;

      const second = await authPost(landlordLimitToken, {
        name: `Limit 2 ${ts}`,
        address: 'L2',
        electricityUnitPrice: 1,
        waterUnitPrice: 1,
      });
      expect(second.status).toBe(403);
      expect(second.body.error.code).toBe('PLAN_LIMIT_REACHED');

      const deactivate = await request(app)
        .patch(`/api/properties/${firstId}/deactivate`)
        .set('Authorization', `Bearer ${landlordLimitToken}`);
      expect(deactivate.status).toBe(200);

      const third = await authPost(landlordLimitToken, {
        name: `Limit 3 ${ts}`,
        address: 'L3',
        electricityUnitPrice: 1,
        waterUnitPrice: 1,
      });
      expect(third.status).toBe(201);
    });
  });

  describe('Đồng thời: hai POST song song không vượt giới hạn', () => {
    it('Chỉ một request thành công khi gói cho phép 1 nhà trọ', async () => {
      const [c1, c2] = await Promise.all([
        authPost(landlordConcToken, {
          name: `Conc 1 ${ts}`,
          address: 'Đường C1',
          electricityUnitPrice: 1,
          waterUnitPrice: 1,
        }),
        authPost(landlordConcToken, {
          name: `Conc 2 ${ts}`,
          address: 'Đường C2',
          electricityUnitPrice: 1,
          waterUnitPrice: 1,
        }),
      ]);

      const statuses = [c1.status, c2.status].sort((x, y) => x - y);
      expect(statuses).toEqual([201, 403]);
    });
  });
});
