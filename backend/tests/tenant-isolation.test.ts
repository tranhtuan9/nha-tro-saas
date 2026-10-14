import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prismaSystem, prismaAppUser, getTenantDb, withTenantTransaction } from '../src/lib/db';
import { TenantStatus, UserRole, UserStatus } from '@prisma/client';

describe('Kiểm thử cô lập Tenant trên PostgreSQL thật (Row-Level Security)', () => {
  let planId: string;
  let tenantAId: string;
  let tenantBId: string;
  let propertyAId: string;

  beforeAll(async () => {
    // 1. Dùng prismaSystem (app_system, BYPASSRLS) để chuẩn bị môi trường test
    const plan = await prismaSystem.plan.findFirst({
      where: { name: 'Cơ bản' },
    });
    if (!plan) {
      throw new Error('Không tìm thấy gói Cơ bản trong database. Vui lòng chạy seed trước.');
    }
    planId = plan.id;

    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Tạo Tenant A
    const tenantA = await prismaSystem.tenant.create({
      data: {
        name: 'Tenant Test A',
        planId: planId,
        status: TenantStatus.ACTIVE,
        subscriptionStart: now,
        subscriptionEnd: nextMonth,
      },
    });
    tenantAId = tenantA.id;

    // Tạo Landlord A
    await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: `landlord.a.${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Chủ trọ A',
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });

    // Tạo Tenant B
    const tenantB = await prismaSystem.tenant.create({
      data: {
        name: 'Tenant Test B',
        planId: planId,
        status: TenantStatus.ACTIVE,
        subscriptionStart: now,
        subscriptionEnd: nextMonth,
      },
    });
    tenantBId = tenantB.id;

    // Tạo Landlord B
    await prismaSystem.user.create({
      data: {
        tenantId: tenantBId,
        email: `landlord.b.${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Chủ trọ B',
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test bằng prismaSystem (BYPASSRLS)
    if (tenantAId) {
      await prismaSystem.room.deleteMany({ where: { tenantId: tenantAId } });
      await prismaSystem.property.deleteMany({ where: { tenantId: tenantAId } });
      await prismaSystem.user.deleteMany({ where: { tenantId: tenantAId } });
      await prismaSystem.tenant.delete({ where: { id: tenantAId } });
    }
    if (tenantBId) {
      await prismaSystem.room.deleteMany({ where: { tenantId: tenantBId } });
      await prismaSystem.property.deleteMany({ where: { tenantId: tenantBId } });
      await prismaSystem.user.deleteMany({ where: { tenantId: tenantBId } });
      await prismaSystem.tenant.delete({ where: { id: tenantBId } });
    }

    await prismaSystem.$disconnect();
    await prismaAppUser.$disconnect();
  });

  it('1. Tenant A tạo Nhà trọ và Phòng thông qua getTenantDb(tenantA)', async () => {
    const dbA = getTenantDb(tenantAId);

    // Tạo Nhà trọ cho Tenant A
    const propertyA = await dbA.property.create({
      data: {
        tenantId: tenantAId,
        name: 'Nhà trọ Hoa Mai (A)',
        address: '123 Đường A, Quận 1',
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        isActive: true,
      },
    });

    expect(propertyA).toBeDefined();
    expect(propertyA.tenantId).toBe(tenantAId);
    propertyAId = propertyA.id;

    // Tạo Phòng cho Tenant A
    const roomA = await dbA.room.create({
      data: {
        tenantId: tenantAId,
        propertyId: propertyA.id,
        roomCode: 'P101',
        areaM2: 25.5,
        basePrice: 3500000,
      },
    });

    expect(roomA).toBeDefined();
    expect(roomA.tenantId).toBe(tenantAId);
    expect(roomA.roomCode).toBe('P101');

    // Tenant A truy vấn danh sách -> Thấy đúng 1 Nhà trọ và 1 Phòng
    const properties = await dbA.property.findMany();
    expect(properties.length).toBe(1);
    expect(properties[0].id).toBe(propertyA.id);

    const rooms = await dbA.room.findMany();
    expect(rooms.length).toBe(1);
    expect(rooms[0].id).toBe(roomA.id);
  });

  it('2. Tenant B dùng getTenantDb(tenantB) KHÔNG THỂ thấy dữ liệu của Tenant A (RLS chặn đọc)', async () => {
    const dbB = getTenantDb(tenantBId);

    // Tenant B lấy danh sách Nhà trọ -> Phải rỗng
    const properties = await dbB.property.findMany();
    expect(properties.length).toBe(0);

    // Tenant B lấy danh sách Phòng -> Phải rỗng
    const rooms = await dbB.room.findMany();
    expect(rooms.length).toBe(0);

    // Tenant B cố tình tìm kiếm trực tiếp bằng ID của Nhà trọ A -> Phải ra null
    const targetProperty = await dbB.property.findUnique({
      where: { id: propertyAId },
    });
    expect(targetProperty).toBeNull();
  });

  it('3. Tenant B cố tình sửa/xóa dữ liệu của Tenant A -> RLS chặn cập nhật', async () => {
    const dbB = getTenantDb(tenantBId);

    // Tenant B cố gắng cập nhật giá điện của Nhà trọ A -> Bị lỗi RecordNotFound vì RLS ẩn dòng đó
    await expect(
      dbB.property.update({
        where: { id: propertyAId },
        data: { electricityUnitPrice: 9999 },
      })
    ).rejects.toThrow();

    // Kiểm tra lại bằng Client của A: giá điện vẫn giữ nguyên 3500
    const dbA = getTenantDb(tenantAId);
    const unchangedProperty = await dbA.property.findUnique({
      where: { id: propertyAId },
    });
    expect(unchangedProperty?.electricityUnitPrice.toString()).toBe('3500');
  });

  it('4. Truy vấn bằng app_user khi KHÔNG set_config tenant context -> RLS trả về rỗng', async () => {
    // Truy vấn trực tiếp từ prismaAppUser mà không có transaction gán app.current_tenant
    // PostgreSQL RLS: USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
    // Khi current_setting rỗng, biểu thức trả về NULL, không khớp với bất kỳ tenant_id nào
    const properties = await prismaAppUser.property.findMany();
    expect(properties.length).toBe(0);
  });

  it('5. withTenantTransaction thực thi nhiều câu lệnh an toàn trong 1 transaction', async () => {
    const result = await withTenantTransaction(tenantAId, async (tx) => {
      const prop = await tx.property.create({
        data: {
          tenantId: tenantAId,
          name: 'Nhà trọ Hướng Dương (A2)',
          address: '456 Đường B, Quận 2',
          electricityUnitPrice: 4000,
          waterUnitPrice: 25000,
        },
      });

      const room = await tx.room.create({
        data: {
          tenantId: tenantAId,
          propertyId: prop.id,
          roomCode: 'P201',
          areaM2: 30,
          basePrice: 4500000,
        },
      });

      return { prop, room };
    });

    expect(result.prop.name).toBe('Nhà trọ Hướng Dương (A2)');
    expect(result.room.roomCode).toBe('P201');

    // Tenant A thấy 2 nhà trọ
    const dbA = getTenantDb(tenantAId);
    const propertiesA = await dbA.property.findMany();
    expect(propertiesA.length).toBe(2);

    // Tenant B vẫn thấy 0 nhà trọ
    const dbB = getTenantDb(tenantBId);
    const propertiesB = await dbB.property.findMany();
    expect(propertiesB.length).toBe(0);
  });
});
