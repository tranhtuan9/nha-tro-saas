import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';

const PASSWORD = 'Password123!';

describe('Module Dịch vụ (UC17) — /api/services', () => {
  const ts = Date.now();
  let adminToken = '';
  let planId = '';

  let tenantAId = '';
  let landlordAToken = '';
  let propertyAId = '';
  let propertyAInactiveId = '';

  let tenantBId = '';
  let landlordBToken = '';
  let propertyBId = '';
  let serviceBId = '';

  let renterAToken = '';

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

  async function createProperty(tenantId: string, name: string, isActive = true): Promise<string> {
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

  function post(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/services').set('Authorization', `Bearer ${token}`).send(body);
  }

  function patch(token: string, url: string, body?: Record<string, unknown>) {
    return request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body ?? {});
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
        name: `Gói Dịch vụ ${ts}`,
        maxProperties: 5,
        maxRooms: 20,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planId = plan.id;

    const a = await createTenantWithLandlord('Tenant DV A', 'service.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;
    propertyAId = await createProperty(tenantAId, `Nhà DV A ${ts}`);
    propertyAInactiveId = await createProperty(tenantAId, `Nhà DV A ẩn ${ts}`, false);

    const renterEmail = `service.renter.a.${ts}@example.com`;
    await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: renterEmail,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: 'Renter DV A',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    const renterLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: renterEmail, password: PASSWORD });
    renterAToken = renterLogin.body.data.token;

    const b = await createTenantWithLandlord('Tenant DV B', 'service.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;
    propertyBId = await createProperty(tenantBId, `Nhà DV B ${ts}`);
    const serviceB = await prismaSystem.service.create({
      data: {
        tenantId: tenantBId,
        propertyId: propertyBId,
        name: `Dịch vụ B ${ts}`,
        unit: 'tháng',
        unitPrice: 100000,
        isActive: true,
      },
    });
    serviceBId = serviceB.id;
  });

  afterAll(async () => {
    const cleanupTenant = async (tenantId: string) => {
      if (!tenantId) return;
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
    it('RENTER không tạo/đọc được -> 403', async () => {
      const get = await request(app)
        .get('/api/services')
        .set('Authorization', `Bearer ${renterAToken}`);
      expect(get.status).toBe(403);

      const create = await post(renterAToken, {
        propertyId: propertyAId,
        name: 'X',
        unit: 'tháng',
        unitPrice: 1000,
      });
      expect(create.status).toBe(403);
    });

    it('ADMIN -> 403', async () => {
      const get = await request(app)
        .get('/api/services')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(get.status).toBe(403);
    });
  });

  describe('Tạo dịch vụ (POST)', () => {
    let createdId = '';

    it('Tạo thành công 201: isActive true, unitPrice trả string', async () => {
      const res = await post(landlordAToken, {
        propertyId: propertyAId,
        name: `Điện ${ts}`,
        unit: 'kWh',
        unitPrice: 3500,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.tenantId).toBe(tenantAId);
      expect(res.body.data.propertyId).toBe(propertyAId);
      expect(res.body.data.isActive).toBe(true);
      expect(typeof res.body.data.unitPrice).toBe('string');
      expect(Number(res.body.data.unitPrice)).toBe(3500);
      createdId = res.body.data.id;
    });

    it('propertyId không tồn tại -> 404 PROPERTY_NOT_FOUND', async () => {
      const res = await post(landlordAToken, {
        propertyId: '00000000-0000-0000-0000-000000000000',
        name: 'Bóng đèn',
        unit: 'cái',
        unitPrice: 1000,
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });

    it('propertyId thuộc Tenant khác -> 404 PROPERTY_NOT_FOUND (RLS)', async () => {
      const res = await post(landlordAToken, {
        propertyId: propertyBId,
        name: 'Bóng đèn',
        unit: 'cái',
        unitPrice: 1000,
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });

    it('property đã ẩn -> 400 PROPERTY_INACTIVE', async () => {
      const res = await post(landlordAToken, {
        propertyId: propertyAInactiveId,
        name: 'Bóng đèn',
        unit: 'cái',
        unitPrice: 1000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROPERTY_INACTIVE');
    });

    it('trùng tên trong cùng nhà trọ -> 409 SERVICE_NAME_CONFLICT', async () => {
      const res = await post(landlordAToken, {
        propertyId: propertyAId,
        name: `Điện ${ts}`,
        unit: 'kWh',
        unitPrice: 3600,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SERVICE_NAME_CONFLICT');
    });

    it('trùng tên với dịch vụ ĐÃ NGỪNG -> 409 SERVICE_NAME_CONFLICT', async () => {
      await patch(landlordAToken, `/api/services/${createdId}/deactivate`);

      const res = await post(landlordAToken, {
        propertyId: propertyAId,
        name: `Điện ${ts}`,
        unit: 'kWh',
        unitPrice: 3600,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SERVICE_NAME_CONFLICT');

      await patch(landlordAToken, `/api/services/${createdId}/activate`);
    });

    it('unitPrice âm hoặc không nguyên -> 400 VALIDATION_ERROR', async () => {
      const negative = await post(landlordAToken, {
        propertyId: propertyAId,
        name: `Nước ${ts}`,
        unit: 'm3',
        unitPrice: -1,
      });
      expect(negative.status).toBe(400);

      const float = await post(landlordAToken, {
        propertyId: propertyAId,
        name: `Nước ${ts}`,
        unit: 'm3',
        unitPrice: 1000.5,
      });
      expect(float.status).toBe(400);
    });
  });

  describe('Danh sách & chi tiết (GET)', () => {
    it('lọc theo propertyId, isActive, search và phân trang', async () => {
      const byProperty = await request(app)
        .get(`/api/services?propertyId=${propertyAId}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(byProperty.status).toBe(200);
      expect(byProperty.body.data.length).toBeGreaterThan(0);
      expect(byProperty.body.data.every((s: { propertyId: string }) => s.propertyId === propertyAId)).toBe(true);

      const byActive = await request(app)
        .get(`/api/services?propertyId=${propertyAId}&isActive=false`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(byActive.status).toBe(200);
      expect(byActive.body.data.length).toBe(0);

      const bySearch = await request(app)
        .get(`/api/services?search=Điện ${ts}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(bySearch.status).toBe(200);
      expect(bySearch.body.data.length).toBeGreaterThanOrEqual(1);

      const paged = await request(app)
        .get('/api/services?page=1&pageSize=1')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(paged.status).toBe(200);
      expect(paged.body.data.length).toBe(1);
      expect(paged.body.pagination.pageSize).toBe(1);
    });

    it('dịch vụ của Tenant khác -> 404', async () => {
      const res = await request(app)
        .get(`/api/services/${serviceBId}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SERVICE_NOT_FOUND');
    });
  });

  describe('Cập nhật (PATCH)', () => {
    let serviceId = '';

    beforeAll(async () => {
      const created = await post(landlordAToken, {
        propertyId: propertyAId,
        name: `Rác ${ts}`,
        unit: 'tháng',
        unitPrice: 20000,
      });
      serviceId = created.body.data.id;
    });

    it('sửa name/unit/unitPrice thành công', async () => {
      const res = await patch(landlordAToken, `/api/services/${serviceId}`, {
        name: `Rác vệ sinh ${ts}`,
        unit: 'hộ',
        unitPrice: 25000,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(`Rác vệ sinh ${ts}`);
      expect(res.body.data.unit).toBe('hộ');
      expect(res.body.data.unitPrice).toBe('25000');
    });

    it('gửi propertyId -> 400 (không đổi nhà trọ)', async () => {
      const res = await patch(landlordAToken, `/api/services/${serviceId}`, {
        propertyId: propertyBId,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      const after = await request(app)
        .get(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(after.body.data.propertyId).toBe(propertyAId);
    });
  });

  describe('Ngừng/Bật lại (idempotent)', () => {
    let serviceId = '';

    beforeAll(async () => {
      const created = await post(landlordAToken, {
        propertyId: propertyAId,
        name: `Internet ${ts}`,
        unit: 'tháng',
        unitPrice: 100000,
      });
      serviceId = created.body.data.id;
    });

    it('deactivate lần đầu -> false, lần hai idempotent 200 -> false', async () => {
      const first = await patch(landlordAToken, `/api/services/${serviceId}/deactivate`);
      expect(first.status).toBe(200);
      expect(first.body.data.isActive).toBe(false);

      const second = await patch(landlordAToken, `/api/services/${serviceId}/deactivate`);
      expect(second.status).toBe(200);
      expect(second.body.data.isActive).toBe(false);
    });

    it('activate lần đầu -> true, lần hai idempotent 200 -> true', async () => {
      const first = await patch(landlordAToken, `/api/services/${serviceId}/activate`);
      expect(first.status).toBe(200);
      expect(first.body.data.isActive).toBe(true);

      const second = await patch(landlordAToken, `/api/services/${serviceId}/activate`);
      expect(second.status).toBe(200);
      expect(second.body.data.isActive).toBe(true);
    });
  });

  describe('Tenant bị tạm ngưng', () => {
    it('mọi route trả 403 TENANT_SUSPENDED', async () => {
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.SUSPENDED },
      });

      const res = await request(app)
        .get('/api/services')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('TENANT_SUSPENDED');

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.ACTIVE },
      });
    });
  });

  describe('Gói hết hạn', () => {
    it('GET 200, POST 403 SUBSCRIPTION_EXPIRED, PATCH 200 (G6)', async () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      const get = await request(app)
        .get('/api/services')
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(get.status).toBe(200);

      const create = await post(landlordAToken, {
        propertyId: propertyAId,
        name: `Khi hết hạn ${ts}`,
        unit: 'tháng',
        unitPrice: 1000,
      });
      expect(create.status).toBe(403);
      expect(create.body.error.code).toBe('SUBSCRIPTION_EXPIRED');

      const existing = get.body.data[0];
      const update = await patch(landlordAToken, `/api/services/${existing.id}`, {
        unitPrice: 12345,
      });
      expect(update.status).toBe(200);

      const deactivate = await patch(landlordAToken, `/api/services/${existing.id}/deactivate`);
      expect(deactivate.status).toBe(200);

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: future },
      });
    });
  });
});
