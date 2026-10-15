import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prismaSystem } from '../src/lib/db';
import { lastSentEmailForTest } from '../src/lib/mail';
import { UserStatus, TenantStatus, UserRole } from '@prisma/client';

describe('Kiểm thử Module Xác thực & Hồ sơ (Auth & Profile)', () => {
  const testEmail = `landlord.auth.${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let landlordToken: string;
  let landlordId: string;
  let tenantId: string;

  beforeAll(async () => {
    // Đảm bảo có gói Cơ bản trong DB
    const plan = await prismaSystem.plan.findFirst({ where: { name: 'Cơ bản' } });
    if (!plan) {
      throw new Error('Gói Cơ bản chưa có trong database.');
    }
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    if (tenantId) {
      await prismaSystem.passwordResetToken.deleteMany({ where: { user: { tenantId } } });
      await prismaSystem.user.deleteMany({ where: { tenantId } });
      await prismaSystem.tenant.delete({ where: { id: tenantId } });
    }
  });

  describe('1. UC08: Đăng ký tài khoản Landlord', () => {
    it('Đăng ký thành công tạo Tenant và User trong MỘT transaction', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          fullName: 'Chủ Trọ Test Auth',
          phone: '0901234567',
          nationalId: '012345678901',
          tenantName: 'Nhà Trọ Hạnh Phúc',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.token).toBeDefined();

      const user = res.body.data.user;
      const tenant = res.body.data.tenant;

      expect(user.email).toBe(testEmail);
      expect(user.role).toBe(UserRole.LANDLORD);
      expect(user.status).toBe(UserStatus.ACTIVE);

      // BẢO MẬT: Tuyệt đối không trả passwordHash
      expect(user.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      // Kiểm tra ngày hết hạn dùng thử = now + TRIAL_DAYS (14 ngày)
      const trialDays = parseInt(process.env.TRIAL_DAYS || '14', 10);
      const start = new Date(tenant.subscriptionStart);
      const end = new Date(tenant.subscriptionEnd);
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(trialDays);

      landlordToken = res.body.data.token;
      landlordId = user.id;
      tenantId = tenant.id;
    });

    it('Từ chối đăng ký khi email đã tồn tại', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'AnotherPassword123',
          fullName: 'Trùng Email',
          tenantName: 'Nhà Trọ Trùng',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('đã được sử dụng');
    });

    it('Từ chối khi dữ liệu không hợp lệ (Zod)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // < 6 ký tự
          fullName: '',
          tenantName: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toBeDefined();
    });
  });

  describe('2. UC01, UC09, UC24: Đăng nhập', () => {
    it('Đăng nhập thành công với thông tin chính xác', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
      // BẢO MẬT: Không trả passwordHash
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('Đăng nhập thất bại khi sai mật khẩu', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('không chính xác');
    });

    it('Chặn đăng nhập khi tài khoản bị khóa (LOCKED)', async () => {
      // Khóa tài khoản tạm thời để test
      await prismaSystem.user.update({
        where: { id: landlordId },
        data: { status: UserStatus.LOCKED },
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('đã bị khóa');

      // Mở lại tài khoản
      await prismaSystem.user.update({
        where: { id: landlordId },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('Chặn đăng nhập khi Tenant bị tạm ngưng (SUSPENDED)', async () => {
      // Tạm ngưng Tenant để test
      await prismaSystem.tenant.update({
        where: { id: tenantId },
        data: { status: TenantStatus.SUSPENDED },
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('tạm ngưng');

      // Mở lại Tenant
      await prismaSystem.tenant.update({
        where: { id: tenantId },
        data: { status: TenantStatus.ACTIVE },
      });
    });

    it('Đăng nhập tài khoản Admin mặc định thành công (không bị ảnh hưởng bởi Tenant)', async () => {
      const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
      const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'change_me';

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminEmail,
          password: adminPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(UserRole.ADMIN);
      expect(res.body.data.user.tenantId).toBeNull();
    });
  });

  describe('3. UC03, UC11, UC26: Hồ sơ cá nhân (Me)', () => {
    it('Lấy thông tin cá nhân với JWT hợp lệ', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(landlordId);
      expect(res.body.data.email).toBe(testEmail);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('Chặn truy cập khi thiếu hoặc sai JWT token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);

      const resInvalid = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(resInvalid.status).toBe(401);
    });

    it('Cập nhật hồ sơ cá nhân thành công', async () => {
      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          fullName: 'Chủ Trọ Đã Đổi Tên',
          phone: '0988776655',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Chủ Trọ Đã Đổi Tên');
      expect(res.body.data.phone).toBe('0988776655');
    });

    it('Đổi mật khẩu thành công và kiểm tra đăng nhập bằng mật khẩu mới', async () => {
      const newPassword = 'NewSecretPassword123!';

      const resChange = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: newPassword,
        });

      expect(resChange.status).toBe(200);

      // Đăng nhập lại bằng mật khẩu mới
      const resLoginNew = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: newPassword,
        });

      expect(resLoginNew.status).toBe(200);

      // Cập nhật lại landlordToken với phiên mới
      landlordToken = resLoginNew.body.data.token;
    });
  });

  describe('4. UC02, UC10, UC25: Quên & Đặt lại mật khẩu', () => {
    it('Quên mật khẩu trả thông báo chung chống lộ email', async () => {
      // Test với email không tồn tại
      const resNonExistent = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(resNonExistent.status).toBe(200);
      expect(resNonExistent.body.message).toContain('Nếu email tồn tại');

      // Test với email có tồn tại
      const resExistent = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testEmail });

      expect(resExistent.status).toBe(200);
      expect(resExistent.body.message).toContain('Nếu email tồn tại');

      // Kiểm tra mail được gửi và có link kèm token
      expect(lastSentEmailForTest).toBeDefined();
      expect(lastSentEmailForTest?.to).toBe(testEmail);
      expect(lastSentEmailForTest?.text).toContain('token=');
    });

    it('Đặt lại mật khẩu bằng token và ngăn chặn tái sử dụng', async () => {
      // Trích xuất raw token từ email gửi
      const resetLink = lastSentEmailForTest!.text!;
      const tokenMatch = resetLink.match(/token=([a-f0-9]+)/);
      expect(tokenMatch).toBeDefined();
      const rawToken = tokenMatch![1];

      const finalPassword = 'FinalResetPassword123!';

      // Đặt lại mật khẩu
      const resReset = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: finalPassword,
        });

      expect(resReset.status).toBe(200);
      expect(resReset.body.message).toContain('thành công');

      // Thử dùng lại token lần 2 -> Bị từ chối
      const resReuse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'AnotherPassword123',
        });

      expect(resReuse.status).toBe(400);
      expect(resReuse.body.error.message).toContain('hết hạn');

      // Đăng nhập với mật khẩu sau khi đặt lại
      const resLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: finalPassword,
        });

      expect(resLogin.status).toBe(200);
    });
  });
});
