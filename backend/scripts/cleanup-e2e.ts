import { Prisma, PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

// Dọn dữ liệu test dùng app_system (BYPASSRLS) vì phải xóa dữ liệu của nhiều
// Tenant do E2E tạo ra, ngoài phạm vi một request đã xác thực (Luật 3).
const systemDbUrl = process.env.SYSTEM_DATABASE_URL;
if (!systemDbUrl) {
  throw new Error('SYSTEM_DATABASE_URL không được cấu hình trong .env');
}

const prismaSystem = new PrismaClient({ datasourceUrl: systemDbUrl });

async function deleteTenantData(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  await tx.payment.deleteMany({ where: { tenantId } });
  await tx.invoiceLineItem.deleteMany({ where: { tenantId } });
  await tx.invoice.deleteMany({ where: { tenantId } });
  await tx.meterReading.deleteMany({ where: { tenantId } });
  await tx.contract.deleteMany({ where: { tenantId } });
  await tx.service.deleteMany({ where: { tenantId } });
  await tx.room.deleteMany({ where: { tenantId } });
  await tx.property.deleteMany({ where: { tenantId } });
  await tx.notification.deleteMany({ where: { tenantId } });
  await tx.supportRequest.deleteMany({ where: { tenantId } });
  await tx.auditLog.deleteMany({ where: { tenantId } });
  await tx.user.deleteMany({ where: { tenantId } });
  await tx.tenant.deleteMany({ where: { id: tenantId } });
}

async function main(): Promise<void> {
  const candidates = await prismaSystem.tenant.findMany({
    where: { name: { startsWith: 'E2E' } },
    select: { id: true, name: true },
  });
  const targets = candidates.filter((tenant) => tenant.name.startsWith('E2E'));

  if (targets.length === 0) {
    console.log('Không có Tenant nào có tên bắt đầu bằng "E2E".');
    return;
  }

  let deleted = 0;
  for (const tenant of targets) {
    await prismaSystem.$transaction(
      async (tx) => {
        await deleteTenantData(tx, tenant.id);
      },
      { timeout: 60000 },
    );
    deleted += 1;
    console.log(`- Đã dọn Tenant "${tenant.name}" (${tenant.id})`);
  }

  console.log(`Đã dọn ${deleted} Tenant có tên bắt đầu bằng "E2E".`);
}

main()
  .catch((error) => {
    console.error('Lỗi khi dọn dữ liệu E2E:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prismaSystem.$disconnect();
  });
