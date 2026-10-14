import { PrismaClient, Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load biến môi trường từ .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const systemDbUrl = process.env.SYSTEM_DATABASE_URL;
const appDbUrl = process.env.APP_DATABASE_URL;
const ownerDbUrl = process.env.DATABASE_URL;

if (!systemDbUrl || !appDbUrl) {
  throw new Error('SYSTEM_DATABASE_URL và APP_DATABASE_URL phải được cấu hình trong file .env');
}

/**
 * 1. PRISMA CLIENT HỆ THỐNG (Vai trò: app_system)
 * - Có quyền BYPASSRLS.
 * - CHỈ DÙNG TRONG: Module Auth, Webhook payOS, Admin nền tảng, Seed.
 * - Ghi chú rõ lý do sử dụng tại mỗi nơi gọi client này.
 */
export const prismaSystem = new PrismaClient({
  datasourceUrl: systemDbUrl,
});

/**
 * 2. PRISMA CLIENT CHỦ SỞ HỮU (Vai trò: nha_tro_owner)
 * - Dùng cho migration, seed và dọn dẹp môi trường test.
 */
export const prismaOwner = new PrismaClient({
  datasourceUrl: ownerDbUrl || systemDbUrl,
});

/**
 * 3. PRISMA CLIENT NGHIỆP VỤ CƠ BẢN (Vai trò: app_user)
 * - Không superuser, không BYPASSRLS, bị cưỡng chế bởi RLS qua 'app.current_tenant'.
 */
export const prismaAppUser = new PrismaClient({
  datasourceUrl: appDbUrl,
});

/**
 * 4. THỰC THI GIAO DỊCH VỚI TENANT CONTEXT (withTenantTransaction)
 * - Bắt buộc cho mọi thao tác nghiệp vụ nhiều bước (ví dụ: Tạo hóa đơn + Dòng hóa đơn).
 * - Mở một transaction, thiết lập biến phiên 'app.current_tenant' = tenantId (is_local = true).
 * - Biến tự động hết hiệu lực ngay khi transaction kết thúc (commit hoặc rollback).
 */
export async function withTenantTransaction<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prismaAppUser.$transaction(async (tx) => {
    // Thiết lập tenant context cho transaction hiện tại
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return await fn(tx);
  });
}

/**
 * 5. PRISMA CLIENT EXTENSION THEO TENANT (getTenantDb)
 * - Dành cho các truy vấn đơn lẻ của API nghiệp vụ.
 * - Tự động bọc mọi truy vấn model trong transaction có gán 'app.current_tenant'.
 */
export function getTenantDb(tenantId: string) {
  return prismaAppUser.$extends({
    client: {
      /**
       * Mở transaction tùy chỉnh cho tenant hiện tại
       */
      async tenantTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        return withTenantTransaction(tenantId, fn);
      },
    },
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return prismaAppUser.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
            return (tx as any)[model][operation](args);
          });
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof getTenantDb>;
