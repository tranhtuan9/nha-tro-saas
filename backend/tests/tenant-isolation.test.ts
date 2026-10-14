import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prismaSystem, prismaAppUser, getTenantDb, withTenantTransaction } from '../src/lib/db';
import { TenantStatus, UserRole, UserStatus, ContractStatus, AuditSource, AuditStatus } from '@prisma/client';

describe('Kiểm thử cô lập CSDL trên PostgreSQL thật (Row-Level Security & Role Permissions)', () => {
  let planId: string;
  let tenantAId: string;
  let tenantBId: string;
  let landlordAId: string;
  let landlordBId: string;
  let propertyAId: string;
  let renterA1Id: string;
  let renterA2Id: string;
  let contractA1Id: string;
  let contractA2Id: string;

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
    const landlordA = await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: `landlord.a.${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Chủ trọ A',
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });
    landlordAId = landlordA.id;

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
    const landlordB = await prismaSystem.user.create({
      data: {
        tenantId: tenantBId,
        email: `landlord.b.${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Chủ trọ B',
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });
    landlordBId = landlordB.id;

    // Tạo 2 Renter cùng thuộc Tenant A để kiểm thử cô lập giữa các Renter
    const renterA1 = await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: `renter.a1.${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Người thuê A1',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    renterA1Id = renterA1.id;

    const renterA2 = await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: `renter.a2.${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Người thuê A2',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    renterA2Id = renterA2.id;
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test bằng prismaSystem (BYPASSRLS)
    if (tenantAId) {
      await prismaSystem.auditLog.deleteMany({ where: { tenantId: tenantAId } });
      await prismaSystem.contract.deleteMany({ where: { tenantId: tenantAId } });
      await prismaSystem.room.deleteMany({ where: { tenantId: tenantAId } });
      await prismaSystem.property.deleteMany({ where: { tenantId: tenantAId } });
      await prismaSystem.user.deleteMany({ where: { tenantId: tenantAId } });
      await prismaSystem.tenant.delete({ where: { id: tenantAId } });
    }
    if (tenantBId) {
      await prismaSystem.auditLog.deleteMany({ where: { tenantId: tenantBId } });
      await prismaSystem.contract.deleteMany({ where: { tenantId: tenantBId } });
      await prismaSystem.room.deleteMany({ where: { tenantId: tenantBId } });
      await prismaSystem.property.deleteMany({ where: { tenantId: tenantBId } });
      await prismaSystem.user.deleteMany({ where: { tenantId: tenantBId } });
      await prismaSystem.tenant.delete({ where: { id: tenantBId } });
    }

    await prismaSystem.$disconnect();
    await prismaAppUser.$disconnect();
  });

  it('1. Tenant A tạo Nhà trọ và Phòng qua getTenantDb({ tenantId, userId, role })', async () => {
    const dbA = getTenantDb({
      tenantId: tenantAId,
      userId: landlordAId,
      role: 'LANDLORD',
    });

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

    const properties = await dbA.property.findMany();
    expect(properties.length).toBe(1);
    expect(properties[0].id).toBe(propertyA.id);
  });

  it('2. Tenant B KHÔNG THỂ đọc dữ liệu của Tenant A (RLS chặn đọc)', async () => {
    const dbB = getTenantDb({
      tenantId: tenantBId,
      userId: landlordBId,
      role: 'LANDLORD',
    });

    const properties = await dbB.property.findMany();
    expect(properties.length).toBe(0);

    const rooms = await dbB.room.findMany();
    expect(rooms.length).toBe(0);

    const targetProperty = await dbB.property.findUnique({
      where: { id: propertyAId },
    });
    expect(targetProperty).toBeNull();
  });

  it('3. WITH CHECK: Tenant A không thể chèn bản ghi mang tenant_id của Tenant B', async () => {
    const dbA = getTenantDb({
      tenantId: tenantAId,
      userId: landlordAId,
      role: 'LANDLORD',
    });

    // Cố ý truyền tenantId của B vào câu lệnh tạo của Tenant A
    await expect(
      dbA.property.create({
        data: {
          tenantId: tenantBId, // Khác với context tenantAId
          name: 'Nhà trọ gian lận',
          address: '789 Đường X',
          electricityUnitPrice: 3000,
          waterUnitPrice: 15000,
        },
      })
    ).rejects.toThrow(); // Bị PostgreSQL RLS chặn do vi phạm WITH CHECK
  });

  it('4. Không thể sửa hay xóa dữ liệu của Tenant khác', async () => {
    const dbB = getTenantDb({
      tenantId: tenantBId,
      userId: landlordBId,
      role: 'LANDLORD',
    });

    // Thử cập nhật
    await expect(
      dbB.property.update({
        where: { id: propertyAId },
        data: { electricityUnitPrice: 9999 },
      })
    ).rejects.toThrow();

    // Thử xóa
    await expect(
      dbB.property.delete({
        where: { id: propertyAId },
      })
    ).rejects.toThrow();

    // Xác nhận lại bằng Tenant A: dữ liệu vẫn nguyên vẹn
    const dbA = getTenantDb({ tenantId: tenantAId, role: 'LANDLORD' });
    const intact = await dbA.property.findUnique({ where: { id: propertyAId } });
    expect(intact).not.toBeNull();
  });

  it('5. Chưa đặt app.current_tenant thì không trả dòng nào', async () => {
    // app_user truy vấn trực tiếp không có transaction set_config
    const properties = await prismaAppUser.property.findMany();
    expect(properties.length).toBe(0);
  });

  it('6. audit_logs là append-only: app_user KHÔNG THỂ UPDATE hoặc DELETE', async () => {
    const dbA = getTenantDb({
      tenantId: tenantAId,
      userId: landlordAId,
      role: 'LANDLORD',
    });

    // 1. Chèn thành công (INSERT được cấp quyền)
    const log = await dbA.auditLog.create({
      data: {
        tenantId: tenantAId,
        userId: landlordAId,
        source: AuditSource.USER,
        actionType: 'testAction',
        payload: { detail: 'test audit log' },
        status: AuditStatus.PROPOSED,
      },
    });
    expect(log).toBeDefined();

    // 2. Thử UPDATE -> Bị lỗi quyền CSDL (REVOKE UPDATE)
    await expect(
      dbA.auditLog.update({
        where: { id: log.id },
        data: { status: AuditStatus.EXECUTED },
      })
    ).rejects.toThrow();

    // 3. Thử DELETE -> Bị lỗi quyền CSDL (REVOKE DELETE)
    await expect(
      dbA.auditLog.delete({
        where: { id: log.id },
      })
    ).rejects.toThrow();
  });

  it('7. Renter A1 KHÔNG THỂ đọc hợp đồng của Renter A2 (trong cùng một Tenant)', async () => {
    const dbLandlordA = getTenantDb({
      tenantId: tenantAId,
      userId: landlordAId,
      role: 'LANDLORD',
    });

    // Tạo thêm phòng thứ 2 cho Tenant A
    const roomA2 = await dbLandlordA.room.create({
      data: {
        tenantId: tenantAId,
        propertyId: propertyAId,
        roomCode: 'P102',
        areaM2: 30,
        basePrice: 4000000,
      },
    });

    const now = new Date();
    const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Tạo Hợp đồng 1 cho Renter A1
    const contract1 = await dbLandlordA.contract.create({
      data: {
        tenantId: tenantAId,
        roomId: (await dbLandlordA.room.findFirst({ where: { roomCode: 'P101' } }))!.id,
        renterId: renterA1Id,
        startDate: now,
        endDate: nextYear,
        monthlyRent: 3500000,
        status: ContractStatus.ACTIVE,
      },
    });
    contractA1Id = contract1.id;

    // Tạo Hợp đồng 2 cho Renter A2
    const contract2 = await dbLandlordA.contract.create({
      data: {
        tenantId: tenantAId,
        roomId: roomA2.id,
        renterId: renterA2Id,
        startDate: now,
        endDate: nextYear,
        monthlyRent: 4000000,
        status: ContractStatus.ACTIVE,
      },
    });
    contractA2Id = contract2.id;

    // --- KIỂM THỬ TRUY VẤN VỚI ROLE = RENTER ---
    const dbRenterA1 = getTenantDb({
      tenantId: tenantAId,
      userId: renterA1Id,
      role: 'RENTER',
    });

    const dbRenterA2 = getTenantDb({
      tenantId: tenantAId,
      userId: renterA2Id,
      role: 'RENTER',
    });

    // Renter A1 chỉ thấy đúng 1 hợp đồng (Hợp đồng 1 của mình)
    const contractsA1 = await dbRenterA1.contract.findMany();
    expect(contractsA1.length).toBe(1);
    expect(contractsA1[0].id).toBe(contractA1Id);
    expect(contractsA1[0].renterId).toBe(renterA1Id);

    // Renter A1 cố ý tìm Hợp đồng 2 -> Phải ra null
    const hiddenContractForA1 = await dbRenterA1.contract.findUnique({
      where: { id: contractA2Id },
    });
    expect(hiddenContractForA1).toBeNull();

    // Renter A2 chỉ thấy đúng 1 hợp đồng (Hợp đồng 2 của mình)
    const contractsA2 = await dbRenterA2.contract.findMany();
    expect(contractsA2.length).toBe(1);
    expect(contractsA2[0].id).toBe(contractA2Id);
    expect(contractsA2[0].renterId).toBe(renterA2Id);

    // Renter A2 cố ý tìm Hợp đồng 1 -> Phải ra null
    const hiddenContractForA2 = await dbRenterA2.contract.findUnique({
      where: { id: contractA1Id },
    });
    expect(hiddenContractForA2).toBeNull();

    // Trong khi đó, Landlord A xem danh sách -> Thấy đầy đủ cả 2 hợp đồng
    const allContractsLandlord = await dbLandlordA.contract.findMany();
    expect(allContractsLandlord.length).toBe(2);
  });
});
