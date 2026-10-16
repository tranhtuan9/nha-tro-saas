import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { lastSentEmailForTest } from '../src/lib/mail';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';

const PASSWORD = 'Password123!';

describe('Module Người thuê (UC14) — /api/renters', () => {
  const ts = Date.now();
  let planNormalId = '';

  let tenantAId = '';
  let landlordAToken = '';
  let landlordAId = '';
  let renterA1Id = ''; // ACTIVE, có phone/nationalId dùng cho test trùng lặp
  let renterALockedId = '';

  let tenantBId = '';
  let landlordBToken = '';
  let renterB1Id = '';

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

  async function createRenterDirect(
    tenantId: string,
    key: string,
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const renter = await prismaSystem.user.create({
      data: {
        tenantId,
        email: `${key}.${ts}@example.com`,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        fullName: `Người thuê ${key}`,
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
        ...overrides,
      },
    });
    return renter.id;
  }

  function authGet(token: string, url = '/api/renters') {
    return request(app).get(url).set('Authorization', `Bearer ${token}`);
  }

  function authPost(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/renters').set('Authorization', `Bearer ${token}`).send(body);
  }

  function authPatch(token: string, id: string, body: Record<string, unknown>) {
    return request(app)
      .patch(`/api/renters/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  beforeAll(async () => {
    const plan = await prismaSystem.plan.create({
      data: {
        name: `Gói Thường NT ${ts}`,
        maxProperties: 5,
        maxRooms: 50,
        price: 0,
        durationDays: 30,
        isActive: true,
      },
    });
    planNormalId = plan.id;

    const a = await createTenantWithLandlord('Tenant NT A', planNormalId, 'renter.landlord.a');
    tenantAId = a.tenantId;
    landlordAToken = a.token;
    landlordAId = a.landlordId;

    const b = await createTenantWithLandlord('Tenant NT B', planNormalId, 'renter.landlord.b');
    tenantBId = b.tenantId;
    landlordBToken = b.token;

    renterA1Id = await createRenterDirect(tenantAId, 'renter.a1', {
      phone: `0900${ts % 100000000}`,
      nationalId: `CC${ts % 100000000}`,
    });
    renterALockedId = await createRenterDirect(tenantAId, 'renter.a.locked', {
      status: UserStatus.LOCKED,
    });
    renterB1Id = await createRenterDirect(tenantBId, 'renter.b1', {
      phone: `0911${ts % 100000000}`,
      nationalId: `CCB${ts % 100000000}`,
    });
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

  describe('Tạo người thuê (POST)', () => {
    let invitedEmail = '';
    let invitedRenterId = '';
    let inviteToken = '';

    it('Tạo thành công 201: inviteTokenSent=true, KHÔNG trả passwordHash, CCCD bị che', async () => {
      invitedEmail = `invite.renter.${ts}@example.com`;
      const rawNationalId = `CCM${ts % 100000000}`;
      const res = await authPost(landlordAToken, {
        email: invitedEmail,
        fullName: 'Người Mời Tạo',
        phone: `0920${ts % 100000000}`,
        nationalId: rawNationalId,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.inviteTokenSent).toBe(true);
      const user = res.body.data.user;
      invitedRenterId = user.id;
      expect(user.email).toBe(invitedEmail);
      expect(user.role).toBe(UserRole.RENTER);
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.tenantId).toBe(tenantAId);
      expect(user.passwordHash).toBeUndefined();
      // Response tạo mới KHÔNG phải chi tiết -> CCCD chỉ được trả dạng che.
      expect(user.nationalId).not.toBe(rawNationalId);
      expect(user.nationalId).toContain('•');

      const inDb = await prismaSystem.user.findUnique({ where: { id: invitedRenterId } });
      expect(inDb?.role).toBe(UserRole.RENTER);
      expect(inDb?.passwordHash).toBe('');
      expect(inDb?.nationalId).toBe(rawNationalId);
    });

    it('Gửi email mời dùng lại flow reset-password (Q3): link /reset-password?token=', async () => {
      expect(lastSentEmailForTest).toBeDefined();
      expect(lastSentEmailForTest?.to).toBe(invitedEmail);
      expect(lastSentEmailForTest?.text).toContain('/reset-password?token=');

      const match = lastSentEmailForTest!.text!.match(/token=([a-f0-9]+)/);
      expect(match).toBeDefined();
      inviteToken = match![1];
    });

    it('Dùng token mời để đặt mật khẩu rồi đăng nhập được (Q3)', async () => {
      const reset = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: inviteToken, newPassword: 'MoiDatMatKhau123!' });
      expect(reset.status).toBe(200);

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: invitedEmail, password: 'MoiDatMatKhau123!' });
      expect(login.status).toBe(200);
      expect(login.body.data.user.role).toBe(UserRole.RENTER);
    });

    it('Email trùng trong cùng Tenant -> 409 EMAIL_CONFLICT', async () => {
      const res = await authPost(landlordAToken, {
        email: invitedEmail,
        fullName: 'Người Trùng Email',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_CONFLICT');
    });

    it('Email đã dùng ở Tenant khác -> vẫn 409 EMAIL_CONFLICT (email unique toàn cục)', async () => {
      const res = await authPost(landlordBToken, {
        email: invitedEmail,
        fullName: 'Người Trùng Email B',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_CONFLICT');
    });

    it('Phone trùng trong cùng Tenant -> 409 PHONE_CONFLICT', async () => {
      const renterA1 = await prismaSystem.user.findUnique({ where: { id: renterA1Id } });
      const res = await authPost(landlordAToken, {
        email: `phone.conflict.${ts}@example.com`,
        fullName: 'Người Trùng SĐT',
        phone: renterA1!.phone,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PHONE_CONFLICT');
    });

    it('NationalId trùng trong cùng Tenant -> 409 NATIONAL_ID_CONFLICT', async () => {
      const renterA1 = await prismaSystem.user.findUnique({ where: { id: renterA1Id } });
      const res = await authPost(landlordAToken, {
        email: `cccd.conflict.${ts}@example.com`,
        fullName: 'Người Trùng CCCD',
        nationalId: renterA1!.nationalId,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NATIONAL_ID_CONFLICT');
    });

    it('Phone trùng nhưng ở Tenant khác -> vẫn tạo được 201', async () => {
      const renterB1 = await prismaSystem.user.findUnique({ where: { id: renterB1Id } });
      const res = await authPost(landlordAToken, {
        email: `phone.other.tenant.${ts}@example.com`,
        fullName: 'Người Thuê Khác Tenant',
        phone: renterB1!.phone,
        nationalId: renterB1!.nationalId,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.user.id).toBeTruthy();
    });

    it('Thiếu fullName -> 400 VALIDATION_ERROR', async () => {
      const res = await authPost(landlordAToken, { email: `missing.name.${ts}@example.com` });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Danh sách (GET)', () => {
    it('Trả 200 kèm pagination, chỉ chứa người dùng role RENTER', async () => {
      const res = await authGet(landlordAToken, '/api/renters?page=1&pageSize=100');
      expect(res.status).toBe(200);
      expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 100 });
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((r: { role: string }) => r.role === UserRole.RENTER)).toBe(true);
      expect(res.body.data.some((r: { id: string }) => r.id === renterA1Id)).toBe(true);
      // Landlord không xuất hiện trong danh sách người thuê
      expect(res.body.data.some((r: { id: string }) => r.id === landlordAId)).toBe(false);
      expect(res.body.data.every((r: { passwordHash?: string }) => r.passwordHash === undefined)).toBe(
        true
      );

      // CCCD trong danh sách chỉ được trả dạng CHE một phần.
      const renterA1Row = res.body.data.find((r: { id: string }) => r.id === renterA1Id);
      expect(renterA1Row.nationalId).toBeDefined();
      expect(renterA1Row.nationalId).toContain('•');
      expect(renterA1Row.nationalId).not.toBe(`CC${ts % 100000000}`);
      // Người thuê không có CCCD thì trả null.
      const lockedRow = res.body.data.find((r: { id: string }) => r.id === renterALockedId);
      expect(lockedRow.nationalId).toBeNull();
    });

    it('Lọc theo status=LOCKED chỉ trả người bị khóa', async () => {
      const res = await authGet(landlordAToken, '/api/renters?status=LOCKED');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((r: { status: string }) => r.status === UserStatus.LOCKED)).toBe(
        true
      );
      expect(res.body.data.some((r: { id: string }) => r.id === renterALockedId)).toBe(true);
    });

    it('Tìm kiếm theo fullName/phone (không phân biệt hoa thường)', async () => {
      const byName = await authGet(
        landlordAToken,
        `/api/renters?search=${encodeURIComponent('người thuê renter.a1')}`
      );
      expect(byName.status).toBe(200);

      const renterA1 = await prismaSystem.user.findUnique({ where: { id: renterA1Id } });
      const byPhone = await authGet(landlordAToken, `/api/renters?search=${renterA1!.phone}`);
      expect(byPhone.status).toBe(200);
      expect(byPhone.body.data.some((r: { id: string }) => r.id === renterA1Id)).toBe(true);
    });
  });

  describe('Chi tiết & Sửa (GET/:id, PATCH/:id)', () => {
    it('GET chi tiết 200, không trả passwordHash, CCCD trả ĐẦY ĐỦ cho Landlord cùng Tenant', async () => {
      const res = await authGet(landlordAToken, `/api/renters/${renterA1Id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(renterA1Id);
      expect(res.body.data.role).toBe(UserRole.RENTER);
      expect(res.body.data.passwordHash).toBeUndefined();
      // Chi tiết trả đầy đủ CCCD (không che).
      expect(res.body.data.nationalId).toBe(`CC${ts % 100000000}`);
      expect(res.body.data.nationalId).not.toContain('•');
    });

    it('PATCH sửa fullName/phone thành công', async () => {
      const newPhone = `0933${ts % 100000000}`;
      const res = await authPatch(landlordAToken, renterA1Id, {
        fullName: 'Tên Mới Sau Sửa',
        phone: newPhone,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Tên Mới Sau Sửa');
      expect(res.body.data.phone).toBe(newPhone);
    });

    it('PATCH đặt phone=null được chấp nhận', async () => {
      const res = await authPatch(landlordAToken, renterA1Id, { phone: null });
      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBeNull();
    });

    it('PATCH không trường nào -> 400 VALIDATION_ERROR', async () => {
      const res = await authPatch(landlordAToken, renterA1Id, {});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET người thuê của Tenant khác -> 404 RENTER_NOT_FOUND', async () => {
      const res = await authGet(landlordAToken, `/api/renters/${renterB1Id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RENTER_NOT_FOUND');
    });

    it('PATCH người thuê của Tenant khác -> 404 RENTER_NOT_FOUND', async () => {
      const res = await authPatch(landlordAToken, renterB1Id, { fullName: 'Hack' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RENTER_NOT_FOUND');
    });

    it('GET bằng chính ID Landlord -> 404 (chỉ liệt kê role RENTER)', async () => {
      const res = await authGet(landlordAToken, `/api/renters/${landlordAId}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RENTER_NOT_FOUND');
    });
  });

  describe('Gửi lại lời mời (POST /:id/resend-invite)', () => {
    let inviteRenterId = '';
    let inviteEmail = '';
    let firstToken = '';
    let secondToken = '';

    it('Gửi lại thành công 200: token mới dùng được, email gửi lại', async () => {
      inviteEmail = `resend.renter.${ts}@example.com`;
      const created = await authPost(landlordAToken, {
        email: inviteEmail,
        fullName: 'Người Nhận Lại Lời Mời',
      });
      expect(created.status).toBe(201);
      inviteRenterId = created.body.data.user.id;

      const firstMatch = lastSentEmailForTest!.text!.match(/token=([a-f0-9]+)/);
      expect(firstMatch).toBeDefined();
      firstToken = firstMatch![1];

      const res = await request(app)
        .post(`/api/renters/${inviteRenterId}/resend-invite`)
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.inviteTokenSent).toBe(true);

      // Email gửi lại cho đúng người, kèm token MỚI khác token cũ.
      expect(lastSentEmailForTest?.to).toBe(inviteEmail);
      const secondMatch = lastSentEmailForTest!.text!.match(/token=([a-f0-9]+)/);
      expect(secondMatch).toBeDefined();
      secondToken = secondMatch![1];
      expect(secondToken).not.toBe(firstToken);

      // Token mới đặt mật khẩu được.
      const useNew = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: secondToken, newPassword: 'MatKhauMoi123!' });
      expect(useNew.status).toBe(200);
    });

    it('Token mời CŨ không dùng được sau khi gửi lại -> 400 INVALID_RESET_TOKEN', async () => {
      const useOld = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: firstToken, newPassword: 'MatKhauKhac123!' });
      expect(useOld.status).toBe(400);
      expect(useOld.body.error.code).toBe('INVALID_RESET_TOKEN');
    });

    it('Renter đã từng đăng nhập -> 409 INVITE_NOT_APPLICABLE', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: inviteEmail, password: 'MatKhauMoi123!' });
      expect(login.status).toBe(200);

      const res = await request(app)
        .post(`/api/renters/${inviteRenterId}/resend-invite`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVITE_NOT_APPLICABLE');
    });

    it('Người thuê của Tenant khác -> 404 RENTER_NOT_FOUND', async () => {
      const res = await request(app)
        .post(`/api/renters/${renterB1Id}/resend-invite`)
        .set('Authorization', `Bearer ${landlordAToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RENTER_NOT_FOUND');
    });

    it('RENTER gọi resend-invite -> 403 FORBIDDEN', async () => {
      const renterLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: `renter.a1.${ts}@example.com`, password: PASSWORD });
      expect(renterLogin.status).toBe(200);

      const res = await request(app)
        .post(`/api/renters/${renterA1Id}/resend-invite`)
        .set('Authorization', `Bearer ${renterLogin.body.data.token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Phân quyền & trạng thái Tenant', () => {
    it('RENTER gọi API -> 403 FORBIDDEN', async () => {
      const renterLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: `renter.a1.${ts}@example.com`, password: PASSWORD });
      expect(renterLogin.status).toBe(200);

      const res = await request(app)
        .get('/api/renters')
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
        .get('/api/renters')
        .set('Authorization', `Bearer ${adminLogin.body.data.token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Tenant SUSPENDED -> 403 TENANT_SUSPENDED', async () => {
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.SUSPENDED },
      });

      const res = await authGet(landlordAToken);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('TENANT_SUSPENDED');

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { status: TenantStatus.ACTIVE },
      });
    });
  });

  describe('Hết hạn gói dịch vụ', () => {
    it('GET vẫn 200, POST -> 403 SUBSCRIPTION_EXPIRED', async () => {
      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      const get = await authGet(landlordAToken);
      expect(get.status).toBe(200);

      const post = await authPost(landlordAToken, {
        email: `expired.subscription.${ts}@example.com`,
        fullName: 'Hết Hạn Gói',
      });
      expect(post.status).toBe(403);
      expect(post.body.error.code).toBe('SUBSCRIPTION_EXPIRED');

      const patch = await authPatch(landlordAToken, renterA1Id, { fullName: 'Còn Sửa Được' });
      expect(patch.status).toBe(200);

      await prismaSystem.tenant.update({
        where: { id: tenantAId },
        data: { subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
    });
  });
});
