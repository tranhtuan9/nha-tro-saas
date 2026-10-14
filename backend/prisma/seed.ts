import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Seed sử dụng vai trò app_system (BYPASSRLS) để khởi tạo dữ liệu hệ thống
const systemDbUrl = process.env.SYSTEM_DATABASE_URL;
if (!systemDbUrl) {
  throw new Error('SYSTEM_DATABASE_URL không được cấu hình trong .env');
}

const prisma = new PrismaClient({
  datasourceUrl: systemDbUrl,
});

async function main() {
  console.log('--- Bắt đầu chạy Seed dữ liệu ban đầu ---');

  // 1. Tạo 2 gói dịch vụ SaaS (Plan)
  console.log('1. Khởi tạo các gói dịch vụ SaaS...');
  const trialDays = parseInt(process.env.TRIAL_DAYS || '14', 10);

  const basicPlan = await prisma.plan.upsert({
    where: { name: 'Cơ bản' },
    update: {
      maxProperties: 2,
      maxRooms: 10,
      price: 0,
      durationDays: trialDays,
      isActive: true,
    },
    create: {
      name: 'Cơ bản',
      maxProperties: 2,
      maxRooms: 10,
      price: 0,
      durationDays: trialDays,
      isActive: true,
    },
  });
  console.log(`- Gói Cơ bản (ID: ${basicPlan.id}) đã sẵn sàng.`);

  const advancedPlan = await prisma.plan.upsert({
    where: { name: 'Nâng cao' },
    update: {
      maxProperties: 10,
      maxRooms: 50,
      price: 199000,
      durationDays: 30,
      isActive: true,
    },
    create: {
      name: 'Nâng cao',
      maxProperties: 10,
      maxRooms: 50,
      price: 199000,
      durationDays: 30,
      isActive: true,
    },
  });
  console.log(`- Gói Nâng cao (ID: ${advancedPlan.id}) đã sẵn sàng.`);

  // 2. Tạo tài khoản Admin mặc định
  console.log('2. Khởi tạo tài khoản Admin mặc định...');
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'change_me';
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

  const passwordHash = await bcrypt.hash(adminPassword, bcryptRounds);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      tenantId: null,
    },
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Quản trị viên Hệ thống',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      tenantId: null,
    },
  });
  console.log(`- Tài khoản Admin (${adminUser.email}, ID: ${adminUser.id}) đã sẵn sàng.`);

  console.log('--- Hoàn thành Seed dữ liệu thành công! ---');
}

main()
  .catch((e) => {
    console.error('Lỗi khi chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
