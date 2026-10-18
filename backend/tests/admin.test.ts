import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';

describe('Kiểm thử Module Admin (UC04, UC05, UC06, UC07)', () => {
  let adminToken: string;
  let adminId: string;
  let landlordToken: string;
  let landlordId: string;
  let tenantId: string;
  let renterToken: string;
  let renterId: string;
  let planId: string;
  let defaultPlanId: string;
  let testPlanId: string;

  beforeAll(async () => {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'change_me';

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    adminToken = adminRes.body.data.token;
    adminId = adminRes.body.data.user.id;

    const plan = await prismaSystem.plan.findFirst({ where: { name: 'Cơ bản' } });
    if (!plan) throw new Error('Không tìm thấy gói Cơ bản');
    defaultPlanId = plan.id;

    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const tenant = await prismaSystem.tenant.create({
      data: {
        name: 'Tenant Admin Test',
        planId: defaultPlanId,
        status: TenantStatus.ACTIVE,
        subscriptionStart: now,
        subscriptionEnd: nextMonth,
      },
    });
    tenantId = tenant.id;

    const landlord = await prismaSystem.user.create({
      data: {
        tenantId,
        email: `landlord.admin.${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Landlord Admin Test',
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });
    landlordId = landlord.id;

    const landlordLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: landlord.email, password: 'dummy_hash' });

    const landlordUser = await prismaSystem.user.findUnique({ where: { id: landlordId } });
    if (landlordUser) {
      const { hash } = await import('bcrypt');
      const passwordHash = await hash('Password123!', 10);
      await prismaSystem.user.update({
        where: { id: landlordId },
        data: { passwordHash },
      });
    }

    const landlordLogin2 = await request(app)
      .post('/api/auth/login')
      .send({ email: landlord.email, password: 'Password123!' });
    landlordToken = landlordLogin2.body.data.token;

    const renter = await prismaSystem.user.create({
      data: {
        tenantId,
        email: `renter.admin.${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Renter Admin Test',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    renterId = renter.id;

    const { hash } = await import('bcrypt');
    const renterPasswordHash = await hash('Password123!', 10);
    await prismaSystem.user.update({
      where: { id: renterId },
      data: { passwordHash: renterPasswordHash },
    });

    const renterLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: renter.email, password: 'Password123!' });
    renterToken = renterLogin.body.data.token;

    const testPlan = await prismaSystem.plan.create({
      data: {
        name: `Gói Test Admin ${Date.now()}`,
        maxProperties: 5,
        maxRooms: 20,
        price: 500000,
        durationDays: 30,
        isActive: true,
      },
    });
    testPlanId = testPlan.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prismaSystem.user.deleteMany({ where: { tenantId } });
      await prismaSystem.property.deleteMany({ where: { tenantId } });
      await prismaSystem.tenant.delete({ where: { id: tenantId } });
    }
    if (testPlanId) {
      const tenantsUsingPlan = await prismaSystem.tenant.findFirst({ where: { planId: testPlanId } });
      if (!tenantsUsingPlan) {
        await prismaSystem.plan.delete({ where: { id: testPlanId } });
      }
    }
    await prismaSystem.$disconnect();
  });

  describe('RBAC: Landlord và Renter bị chặn 403', () => {
    it('Landlord nhận 403 ở mọi route admin', async () => {
      const routes = [
        { method: 'get', path: '/api/admin/users' },
        { method: 'get', path: '/api/admin/tenants' },
        { method: 'get', path: '/api/admin/plans' },
      ];

      for (const route of routes) {
        const res = await request(app)[route.method as 'get'](route.path)
          .set('Authorization', `Bearer ${landlordToken}`);
        expect(res.status).toBe(403);
      }
    });

    it('Renter nhận 403 ở mọi route admin', async () => {
      const routes = [
        { method: 'get', path: '/api/admin/users' },
        { method: 'get', path: '/api/admin/tenants' },
        { method: 'get', path: '/api/admin/plans' },
      ];

      for (const route of routes) {
        const res = await request(app)[route.method as 'get'](route.path)
          .set('Authorization', `Bearer ${renterToken}`);
        expect(res.status).toBe(403);
      }
    });
  });

  describe('UC04: Quản lý người dùng', () => {
    it('Admin lấy danh sách người dùng thành công', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });

    it('Admin lọc người dùng theo role', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=LANDLORD')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.every((u: any) => u.role === 'LANDLORD')).toBe(true);
    });

    it('Admin lọc người dùng theo tenantId', async () => {
      const res = await request(app)
        .get(`/api/admin/users?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.every((u: any) => u.tenantId === tenantId)).toBe(true);
    });

    it('Admin tìm kiếm người dùng theo tên', async () => {
      const res = await request(app)
        .get('/api/admin/users?search=Landlord Admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBeGreaterThan(0);
    });

    it('Admin khóa người dùng thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${landlordId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.LOCKED);
    });

    it('Token cũ của user bị khóa bị từ chối ngay', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin mở khóa người dùng thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${landlordId}/unlock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.ACTIVE);
    });

    it('Admin không thể khóa chính mình', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('chính mình');
    });

    it('Response không chứa passwordHash và nationalId', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const user = res.body.data.data[0];
      expect(user.passwordHash).toBeUndefined();
      expect(user.nationalId).toBeUndefined();
    });
  });

  describe('UC05: Quản lý Tenant', () => {
    it('Admin lấy danh sách Tenant thành công', async () => {
      const res = await request(app)
        .get('/api/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
    });

    it('Admin lọc Tenant theo subscriptionStatus', async () => {
      const res = await request(app)
        .get('/api/admin/tenants?subscriptionStatus=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.every((t: any) => t.subscriptionStatus === 'active')).toBe(true);
    });

    it('Admin xem chi tiết Tenant thành công', async () => {
      const res = await request(app)
        .get(`/api/admin/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(tenantId);
      expect(res.body.data.counts).toBeDefined();
      expect(res.body.data.counts.properties).toBeDefined();
      expect(res.body.data.counts.rooms).toBeDefined();
    });

    it('Admin tạm ngưng Tenant thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/tenants/${tenantId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TenantStatus.SUSPENDED);
    });

    it('Token cũ của Landlord thuộc Tenant bị tạm ngưng bị từ chối ngay', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(res.status).toBe(403);
    });

    it('Token cũ của Renter thuộc Tenant bị tạm ngưng bị từ chối ngay', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${renterToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin kích hoạt lại Tenant thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/tenants/${tenantId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TenantStatus.ACTIVE);
    });
  });

  describe('UC06: Quản lý gói dịch vụ', () => {
    it('Admin lấy danh sách gói thành công', async () => {
      const res = await request(app)
        .get('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Admin tạo gói mới thành công', async () => {
      const res = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Gói Test Mới ${Date.now()}`,
          maxProperties: 10,
          maxRooms: 50,
          price: 1000000,
          durationDays: 30,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toContain('Gói Test Mới');
      expect(res.body.data.isActive).toBe(true);
    });

    it('Admin sửa gói thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 600000 });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.price)).toBe(600000);
    });

    it('Admin không thể ẩn gói mặc định', async () => {
      const res = await request(app)
        .patch(`/api/admin/plans/${defaultPlanId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('mặc định');
    });

    it('Admin không thể ẩn gói đang được Tenant sử dụng', async () => {
      const res = await request(app)
        .patch(`/api/admin/plans/${defaultPlanId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('Admin ẩn gói không được sử dụng thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/plans/${testPlanId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('UC07: Đổi gói và gia hạn', () => {
    it('Admin đổi gói cho Tenant thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/tenants/${tenantId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ planId: defaultPlanId, extendDays: 30 });

      expect(res.status).toBe(200);
      expect(res.body.data.planId).toBe(defaultPlanId);
      expect(res.body.warnings).toBeDefined();
    });

    it('Admin không thể gán gói đã ẩn', async () => {
      const res = await request(app)
        .patch(`/api/admin/tenants/${tenantId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ planId: testPlanId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('ẩn');
    });

    it('Admin đổi gói nhỏ hơn số lượng hiện có trả về warnings', async () => {
      await prismaSystem.property.create({
        data: {
          tenantId,
          name: 'Nhà trọ test',
          address: '123 Đường test',
          electricityUnitPrice: 3500,
          waterUnitPrice: 20000,
        },
      });

      const smallPlan = await prismaSystem.plan.create({
        data: {
          name: `Gói Nhỏ ${Date.now()}`,
          maxProperties: 0,
          maxRooms: 0,
          price: 100000,
          durationDays: 30,
        },
      });

      const res = await request(app)
        .patch(`/api/admin/tenants/${tenantId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ planId: smallPlan.id });

      expect(res.status).toBe(200);
      expect(res.body.warnings.length).toBeGreaterThan(0);

      await prismaSystem.property.deleteMany({ where: { tenantId } });
      await prismaSystem.tenant.update({
        where: { id: tenantId },
        data: { planId: defaultPlanId },
      });
      await prismaSystem.plan.delete({ where: { id: smallPlan.id } });
    });

    it('Admin đặt subscriptionEnd trực tiếp', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      const res = await request(app)
        .patch(`/api/admin/tenants/${tenantId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ planId: defaultPlanId, subscriptionEnd: futureDate.toISOString() });

      expect(res.status).toBe(200);
    });
  });

  describe('Idempotent: thao tác lặp trả 200 kèm trạng thái hiện tại', () => {
    it('Khóa tài khoản đã bị khóa trả 200 với trạng thái LOCKED', async () => {
      await request(app)
        .patch(`/api/admin/users/${landlordId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .patch(`/api/admin/users/${landlordId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.LOCKED);

      await request(app)
        .patch(`/api/admin/users/${landlordId}/unlock`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('Mở khóa tài khoản đang hoạt động trả 200 với trạng thái ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${landlordId}/unlock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.ACTIVE);
    });

    it('Tạm ngưng Tenant đã bị tạm ngưng trả 200 với trạng thái SUSPENDED', async () => {
      await request(app)
        .patch(`/api/admin/tenants/${tenantId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .patch(`/api/admin/tenants/${tenantId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TenantStatus.SUSPENDED);
    });

    it('Kích hoạt Tenant đang hoạt động trả 200 với trạng thái ACTIVE', async () => {
      await request(app)
        .patch(`/api/admin/tenants/${tenantId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .patch(`/api/admin/tenants/${tenantId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TenantStatus.ACTIVE);
    });

    it('Ẩn gói đã bị ẩn trả 200 với isActive=false', async () => {
      const plan = await prismaSystem.plan.create({
        data: {
          name: `Gói Idempotent ${Date.now()}`,
          maxProperties: 3,
          maxRooms: 15,
          price: 200000,
          durationDays: 30,
          isActive: true,
        },
      });

      await request(app)
        .patch(`/api/admin/plans/${plan.id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .patch(`/api/admin/plans/${plan.id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);

      await prismaSystem.plan.delete({ where: { id: plan.id } });
    });
  });
});
