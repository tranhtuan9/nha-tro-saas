import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';

const PASSWORD = 'Password123!';

describe('Module Thông báo — /api/notifications', () => {
  const ts = Date.now();
  let planId = '';

  let tenantAId = '';
  let landlordAToken = '';
  let landlordAId = '';
  let renterA1Id = '';
  let renterA1Token = '';
  let renterA2Id = '';
  let renterA2Token = '';

  let tenantBId = '';
  let landlordBToken = '';
  let landlordBId = '';

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
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

  let notifSeq = 0;
  async function seedNotification(
    tenantId: string,
    userId: string,
    overrides: Partial<{ type: string; title: string; isRead: boolean }> = {}
  ): Promise<string> {
    notifSeq += 1;
    const row = await prismaSystem.notification.create({
      data: {
        tenantId,
        userId,
        type: overrides.type ?? 'NEW_INVOICE',
        title: overrides.title ?? `Thông báo ${notifSeq}`,
        content: `Nội dung thông báo ${notifSeq}`,
        isRead: overrides.isRead ?? false,
        createdAt: new Date(Date.now() + notifSeq * 1000),
      },
    });
    return row.id;
  }

  async function countNotifications(userId: string): Promise<number> {
    return prismaSystem.notification.count({ where: { userId } });
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
        name: `Gói Thông báo ${ts}`,
        maxProperties: 10,
        maxRooms: 200,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planId = plan.id;

    const a = await createTenantWithLandlord('Tenant Notif A', 'notif.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;
    landlordAId = a.userId;

    const r1 = await createRenter(tenantAId, 'notif.renter.a1');
    renterA1Id = r1.id;
    renterA1Token = r1.token;
    const r2 = await createRenter(tenantAId, 'notif.renter.a2');
    renterA2Id = r2.id;
    renterA2Token = r2.token;

    const b = await createTenantWithLandlord('Tenant Notif B', 'notif.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;
    landlordBId = b.userId;
  });

  afterAll(async () => {
    const cleanupTenant = async (tenantId: string) => {
      if (!tenantId) return;
      await prismaSystem.notification.deleteMany({ where: { tenantId } });
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
    await prismaSystem.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
  });

  describe('Phân quyền', () => {
    it('Thiếu token -> 401', async () => {
      expect((await request(app).get('/api/notifications')).status).toBe(401);
    });

    it('ADMIN không có quyền -> 403', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
          password: process.env.SEED_ADMIN_PASSWORD || 'change_me',
        });
      const adminToken = login.body.data.token as string;
      expect(
        (await request(app).get('/api/notifications').set(auth(adminToken))).status
      ).toBe(403);
    });

    it('params id không phải UUID -> 400', async () => {
      expect(
        (await request(app).patch('/api/notifications/not-a-uuid/read').set(auth(renterA1Token))).status
      ).toBe(400);
    });
  });

  describe('GET /api/notifications', () => {
    it('Renter chỉ thấy thông báo CỦA MÌNH (cùng tenant, khác user không lộ)', async () => {
      await seedNotification(tenantAId, renterA1Id, { title: 'Của A1' });
      await seedNotification(tenantAId, renterA2Id, { title: 'Của A2' });
      await seedNotification(tenantAId, landlordAId, { title: 'Của Landlord' });

      const res = await request(app).get('/api/notifications').set(auth(renterA1Token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Của A1');
      expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 1 });
      expect(res.body.unreadCount).toBe(1);
    });

    it('unreadCount tính trên toàn bộ chưa đọc, không phụ thuộc bộ lọc isRead', async () => {
      await seedNotification(tenantAId, renterA1Id, { isRead: false });
      await seedNotification(tenantAId, renterA1Id, { isRead: false });
      await seedNotification(tenantAId, renterA1Id, { isRead: true });

      const res = await request(app)
        .get('/api/notifications?isRead=true')
        .set(auth(renterA1Token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.unreadCount).toBe(2);
    });

    it('Hai Landlord cùng Tenant: mỗi người chỉ thấy thông báo của mình', async () => {
      const landlordA2 = await createRenter(tenantAId, 'notif.landlord.a2');
      await seedNotification(tenantAId, landlordAId, { title: 'Của L1' });
      await seedNotification(tenantAId, landlordA2.id, { title: 'Của L2' });

      const res = await request(app).get('/api/notifications').set(auth(landlordAToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Của L1');
    });

    it('Landlord không thấy thông báo của Renter cùng Tenant (chỉ thấy của chính mình)', async () => {
      await seedNotification(tenantAId, landlordAId, { title: 'Của Landlord A' });
      await seedNotification(tenantAId, renterA1Id, { title: 'Của Renter A1' });
      await seedNotification(tenantAId, renterA2Id, { title: 'Của Renter A2' });

      const res = await request(app).get('/api/notifications').set(auth(landlordAToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Của Landlord A');
      expect(res.body.unreadCount).toBe(1);
    });

    it('Sắp xếp mới nhất trước; phân trang pageSize hoạt động', async () => {
      await seedNotification(tenantAId, renterA1Id, { title: 'Cũ' });
      await seedNotification(tenantAId, renterA1Id, { title: 'Mới' });

      const res = await request(app)
        .get('/api/notifications?pageSize=1&page=1')
        .set(auth(renterA1Token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Mới');
      expect(res.body.pagination.total).toBe(2);
    });

    it('Lọc isRead=true / isRead=false', async () => {
      await seedNotification(tenantAId, renterA1Id, { isRead: true });
      await seedNotification(tenantAId, renterA1Id, { isRead: false });

      const unread = await request(app)
        .get('/api/notifications?isRead=false')
        .set(auth(renterA1Token));
      expect(unread.status).toBe(200);
      expect(unread.body.data).toHaveLength(1);
      expect(unread.body.data[0].isRead).toBe(false);

      const read = await request(app)
        .get('/api/notifications?isRead=true')
        .set(auth(renterA1Token));
      expect(read.status).toBe(200);
      expect(read.body.data).toHaveLength(1);
      expect(read.body.data[0].isRead).toBe(true);
    });

    it('isRead không hợp lệ -> 400', async () => {
      expect(
        (await request(app).get('/api/notifications?isRead=maybe').set(auth(renterA1Token))).status
      ).toBe(400);
    });

    it('RLS: Landlord Tenant A không thấy thông báo của Tenant B', async () => {
      await seedNotification(tenantBId, landlordBId, { title: 'Của B' });
      const res = await request(app).get('/api/notifications').set(auth(landlordAToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('Đếm đúng số chưa đọc của chính người gọi', async () => {
      await seedNotification(tenantAId, renterA1Id, { isRead: false });
      await seedNotification(tenantAId, renterA1Id, { isRead: false });
      await seedNotification(tenantAId, renterA1Id, { isRead: true });
      await seedNotification(tenantAId, renterA2Id, { isRead: false });

      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set(auth(renterA1Token));
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('Đánh dấu đã đọc thành công', async () => {
      const id = await seedNotification(tenantAId, renterA1Id);
      const res = await request(app)
        .patch(`/api/notifications/${id}/read`)
        .set(auth(renterA1Token));
      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);

      const row = await prismaSystem.notification.findUnique({ where: { id } });
      expect(row?.isRead).toBe(true);
    });

    it('Thông báo của user khác cùng tenant -> 404, không đổi isRead', async () => {
      const id = await seedNotification(tenantAId, renterA2Id);
      const res = await request(app)
        .patch(`/api/notifications/${id}/read`)
        .set(auth(renterA1Token));
      expect(res.status).toBe(404);

      const row = await prismaSystem.notification.findUnique({ where: { id } });
      expect(row?.isRead).toBe(false);
    });

    it('Thông báo của Tenant khác -> 404 (RLS), không đổi isRead', async () => {
      const id = await seedNotification(tenantBId, landlordBId);
      const res = await request(app)
        .patch(`/api/notifications/${id}/read`)
        .set(auth(renterA1Token));
      expect(res.status).toBe(404);

      const row = await prismaSystem.notification.findUnique({ where: { id } });
      expect(row?.isRead).toBe(false);
    });

    it('Không tồn tại -> 404', async () => {
      expect(
        (
          await request(app)
            .patch('/api/notifications/00000000-0000-0000-0000-000000000000/read')
            .set(auth(renterA1Token))
        ).status
      ).toBe(404);
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    it('Đọc tất cả của chính người gọi, không ảnh hưởng người khác', async () => {
      await seedNotification(tenantAId, renterA1Id, { isRead: false });
      await seedNotification(tenantAId, renterA1Id, { isRead: false });
      await seedNotification(tenantAId, renterA2Id, { isRead: false });

      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set(auth(renterA1Token));
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);

      const a1Unread = await prismaSystem.notification.count({
        where: { userId: renterA1Id, isRead: false },
      });
      const a2Unread = await prismaSystem.notification.count({
        where: { userId: renterA2Id, isRead: false },
      });
      expect(a1Unread).toBe(0);
      expect(a2Unread).toBe(1);
    });

    it('Landlord đánh dấu đọc tất cả: chỉ thông báo của Landlord, không đụng thông báo của Renter cùng Tenant', async () => {
      await seedNotification(tenantAId, landlordAId, { isRead: false });
      await seedNotification(tenantAId, landlordAId, { isRead: false });
      await seedNotification(tenantAId, renterA1Id, { isRead: false });

      const landlordUnreadBefore = await prismaSystem.notification.count({
        where: { userId: landlordAId, isRead: false },
      });
      const renterUnreadBefore = await prismaSystem.notification.count({
        where: { userId: renterA1Id, isRead: false },
      });
      expect(landlordUnreadBefore).toBe(2);
      expect(renterUnreadBefore).toBe(1);

      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set(auth(landlordAToken));
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);

      const landlordUnreadAfter = await prismaSystem.notification.count({
        where: { userId: landlordAId, isRead: false },
      });
      const renterUnreadAfter = await prismaSystem.notification.count({
        where: { userId: renterA1Id, isRead: false },
      });
      expect(landlordUnreadAfter).toBe(0);
      expect(renterUnreadAfter).toBe(renterUnreadBefore);
    });
  });

  describe('Luồng end-to-end', () => {
    it('Đọc từng cái rồi read-all: số chưa đọc về 0 và không vượt quá tổng', async () => {
      const id1 = await seedNotification(tenantAId, renterA1Id, { isRead: false });
      const id2 = await seedNotification(tenantAId, renterA1Id, { isRead: false });

      expect(
        (await request(app).patch(`/api/notifications/${id1}/read`).set(auth(renterA1Token))).status
      ).toBe(200);
      const afterOne = await request(app)
        .get('/api/notifications/unread-count')
        .set(auth(renterA1Token));
      expect(afterOne.body.data.count).toBe(1);

      const all = await request(app).patch('/api/notifications/read-all').set(auth(renterA1Token));
      expect(all.body.data.count).toBe(1);

      const afterAll = await request(app)
        .get('/api/notifications/unread-count')
        .set(auth(renterA1Token));
      expect(afterAll.body.data.count).toBe(0);

      expect(id1).not.toBe(id2);
      expect(await countNotifications(renterA1Id)).toBe(2);
    });
  });
});
