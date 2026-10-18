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
 * Ngữ cảnh người dùng trong phiên làm việc (User Context)
 * Dùng để thiết lập RLS đa tầng (theo Tenant và theo User/Role)
 */
export interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: 'ADMIN' | 'LANDLORD' | 'RENTER' | string;
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
 * - Không superuser, không BYPASSRLS, bị cưỡng chế bởi RLS qua 'app.current_tenant',
 *   'app.current_user_id', và 'app.current_role'.
 */
export const prismaAppUser = new PrismaClient({
  datasourceUrl: appDbUrl,
});

/**
 * Hàm phụ trợ thiết lập các biến phiên RLS trong transaction
 */
async function setSessionContext(
  tx: Prisma.TransactionClient,
  context: TenantContext | string
): Promise<void> {
  const tenantId = typeof context === 'string' ? context : context.tenantId;
  const userId = typeof context === 'string' ? '' : (context.userId || '');
  const role = typeof context === 'string' ? '' : (context.role || '');

  await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.current_role', ${role}, true)`;
}

/**
 * 4. THỰC THI GIAO DỊCH VỚI TENANT/USER CONTEXT (withTenantTransaction)
 * - Bắt buộc cho mọi thao tác nghiệp vụ nhiều bước (ví dụ: Tạo hóa đơn + Dòng hóa đơn).
 * - Mở transaction, thiết lập đồng thời:
 *     + app.current_tenant
 *     + app.current_user_id
 *     + app.current_role
 * - Toàn bộ biến tự động thu hồi ngay khi transaction kết thúc (is_local = true).
 */
export async function withTenantTransaction<T>(
  context: TenantContext | string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prismaAppUser.$transaction(async (tx) => {
    await setSessionContext(tx, context);
    return await fn(tx);
  });
}

/**
 * 5. PRISMA CLIENT EXTENSION THEO TENANT & USER (getTenantDb)
 * - Nhận context gồm { tenantId, userId, role } hoặc string tenantId (tương thích ngược).
 * - Tự động bọc mọi truy vấn model trong transaction có gán đủ 3 biến phiên RLS.
 */
export function getTenantDb(context: TenantContext | string) {
  return prismaAppUser.$extends({
    client: {
      /**
       * Mở transaction tùy chỉnh cho context hiện tại
       */
      async tenantTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        return withTenantTransaction(context, fn);
      },
    },
    query: {
      $allModels: {
        async $allOperations({ model, operation, args }) {
          return prismaAppUser.$transaction(async (tx) => {
            await setSessionContext(tx, context);
            return (tx as any)[model][operation](args);
          });
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof getTenantDb>;
