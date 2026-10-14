import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';

describe('Kiểm thử Module Quản trị nền tảng (Admin)', () => {
  let adminToken: string;
  let landlordToken: string;
  let testTenantId: string;
  let testUserId: string;
  let testPlanId: string;
  let inactivePlanId: string;

  beforeAll(async () => {
    const passwordHash = await import('bcrypt').then((m) =>
      m.default.hash('AdminPass123!', 4)
    );

    const admin = await prismaSystem.user.upsert({
      where: { email: `admin.test.${Date.now()}@example.com` },
      update: {},
      create: {
        email: `admin.test.${Date.now()}@example.com`,
        passwordHash,
        fullName: 'Admin Test',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        tenantId: null,
      },
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'AdminPass123!' });
    adminToken = adminLogin.body.data.token;

    const plan = await prismaSystem.plan.create({
      data: {
        name: `Gói Test ${Date.now()}`,
        maxProperties: 5,
        maxRooms: 20,
        price: 99000,
        durationDays: 30,
        isActive: true,
      },
    });
    testPlanId = plan.id;

    const inactivePlan = await prismaSystem.plan.create({
      data: {
        name: `Gói Ẩn ${Date.now()}`,
        maxProperties: 1,
        maxRooms: 5,
        price: 0,
        durationDays: 7,
        isActive: false,
      },
    });
    inactivePlanId = inactivePlan.id;

    const tenant = await prismaSystem.tenant.create({
      data: {
        name: `Tenant Test ${Date.now()}`,
        planId: testPlanId,
        status: TenantStatus.ACTIVE,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    testTenantId = tenant.id;

    const landlordPass = await import('bcrypt').then((m) =>
      m.default.hash('LandlordPass123!', 4)
    );
    const landlord = await prismaSystem.user.create({
      data: {
        tenantId: testTenantId,
        email: `landlord.admin.${Date.now()}@example.com`,
        passwordHash: landlordPass,
        fullName: 'Landlord Test Admin',
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });
    testUserId = landlord.id;

    const landlordLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: landlord.email, password: 'LandlordPass123!' });
    landlordToken = landlordLogin.body.data.token;
  });

  afterAll(async () => {
    if (testTenantId) {
      await prismaSystem.user.deleteMany({ where: { tenantId: testTenantId } });
      await prismaSystem.tenant.delete({ where: { id: testTenantId } });
    }
    if (testPlanId) {
      await prismaSystem.plan.deleteMany({ where: { id: testPlanId } });
    }
    if (inactivePlanId) {
      await prismaSystem.plan.deleteMany({ where: { id: inactivePlanId } });
    }
    await prismaSystem.user.deleteMany({
      where: { email: { contains: '.admin.' } },
    });
    await prismaSystem.user.deleteMany({
      where: { email: { contains: '.test.' } },
    });
  });

  describe('1. Phân quyền Admin', () => {
    it('Từ chối truy cập khi không có token', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('Từ chối truy cập khi không phải Admin (403)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${landlordToken}`);
      expect(res.status).toBe(403);
    });

    it('Cho phép Admin truy cập', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('2. UC04: Quản lý người dùng', () => {
    it('Lấy danh sách user với pagination, không lộ passwordHash', async () => {
      const res = await request(app)
        .get('/api/admin/users?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data[0].passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('Tìm kiếm user theo email', async () => {
      const res = await request(app)
        .get(`/api/admin/users?search=${encodeURIComponent('landlord.admin')}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('Khóa tài khoản user thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${testUserId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.LOCKED);
    });

    it('Mở khóa tài khoản thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${testUserId}/unlock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.ACTIVE);
    });

    it('Không cho khóa tài khoản Admin', async () => {
      const admins = await prismaSystem.user.findMany({
        where: { role: UserRole.ADMIN },
        take: 1,
      });
      const res = await request(app)
        .patch(`/api/admin/users/${admins[0].id}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Không thể khóa tài khoản Admin');
    });
  });

  describe('3. UC05: Quản lý Tenant', () => {
    it('Lấy danh sách tenant với thông tin plan và số user', async () => {
      const res = await request(app)
        .get('/api/admin/tenants?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toBeDefined();
      const tenant = res.body.data.data.find((t: any) => t.id === testTenantId);
      expect(tenant).toBeDefined();
      expect(tenant.plan).toBeDefined();
      expect(tenant._count.users).toBeGreaterThanOrEqual(1);
    });

    it('Tạm ngưng tenant thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/tenants/${testTenantId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TenantStatus.SUSPENDED);
    });

    it('Kích hoạt lại tenant thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/tenants/${testTenantId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(TenantStatus.ACTIVE);
    });
  });

  describe('4. UC06: Quản lý gói dịch vụ', () => {
    it('Lấy danh sách gói (bao gồm cả gói ẩn)', async () => {
      const res = await request(app)
        .get('/api/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('Cập nhật gói thành công', async () => {
      const res = await request(app)
        .patch(`/api/admin/plans/${testPlanId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxRooms: 50, price: 150000 });

      expect(res.status).toBe(200);
      expect(res.body.data.maxRooms).toBe(50);
      expect(Number(res.body.data.price)).toBe(150000);
    });

    it('Ẩn gói (is_active=false) thành công khi không có tenant', async () => {
      const freePlan = await prismaSystem.plan.create({
        data: {
          name: `Gói Trống ${Date.now()}`,
          maxProperties: 1,
          maxRooms: 1,
          price: 0,
          durationDays: 7,
          isActive: true,
        },
      });

      const res = await request(app)
        .patch(`/api/admin/plans/${freePlan.id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);

      await prismaSystem.plan.delete({ where: { id: freePlan.id } });
    });

    it('Chặn ẩn gói đang có tenant sử dụng', async () => {
      const res = await request(app)
        .patch(`/api/admin/plans/${testPlanId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Không thể ẩn gói');
    });
  });

  describe('5. UC07: Đổi gói và gia hạn', () => {
    it('Đổi gói cho tenant thành công (theo durationDays của gói mới)', async () => {
      const res = await request(app)
        .patch(`/api/admin/tenants/${testTenantId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ planId: testPlanId });

      expect(res.status).toBe(200);
      expect(res.body.data.planId).toBe(testPlanId);
      expect(res.body.data.subscriptionEnd).toBeDefined();

      const end = new Date(res.body.data.subscriptionEnd);
      const diffDays = Math.round((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(29);
    });

    it('Gia hạn thêm ngày cho tenant', async () => {
      const before = await prismaSystem.tenant.findUnique({
        where: { id: testTenantId },
      });
      const beforeEnd = new Date(before!.subscriptionEnd).getTime();

      const res = await request(app)
        .patch(`/api/admin/tenants/${testTenantId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ planId: testPlanId, extendDays: 60 });

      expect(res.status).toBe(200);
      const afterEnd = new Date(res.body.data.subscriptionEnd).getTime();
      expect(afterEnd).toBeGreaterThan(beforeEnd);
    });

    it('Chặn đổi sang gói đã ẩn', async () => {
      const res = await request(app)
        .patch(`/api/admin/tenants/${testTenantId}/plan`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ planId: inactivePlanId });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('đã bị ẩn');
    });
  });
});
