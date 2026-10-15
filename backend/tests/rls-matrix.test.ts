import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prismaSystem, getTenantDb } from '../src/lib/db';
import {
  TenantStatus,
  UserRole,
  UserStatus,
  ContractStatus,
  InvoiceStatus,
  PaymentStatus,
  SupportType,
  SupportStatus,
  RoomStatus,
} from '@prisma/client';

type Db = ReturnType<typeof getTenantDb>;

interface TableCase {
  table: string;
  delegate: string;
  rows: () => { ownId: string; otherId: string; landlordCount: number };
  b: () => { renterOwnId: string; landlordCount: number };
  insertOutside: (db: Db) => Promise<unknown>;
  updateOther: (db: Db, id: string) => Promise<unknown>;
  deleteOther: (db: Db, id: string) => Promise<unknown>;
}

function modelDelegate(db: Db, name: string) {
  return (db as any)[name];
}

describe('RLS matrix: 11 bảng có renter_restrictive_policy (PostgreSQL thật, app_user)', () => {
  const ts = Date.now();
  const month1 = new Date(Date.UTC(2025, 0, 1));
  const month2 = new Date(Date.UTC(2025, 1, 1));
  const month3 = new Date(Date.UTC(2025, 2, 1));
  const month4 = new Date(Date.UTC(2025, 3, 1));
  const due1 = new Date(Date.UTC(2025, 0, 15));
  const due4 = new Date(Date.UTC(2025, 3, 15));

  let planId: string;
  let tenantAId: string;
  let tenantBId: string;
  let landlordAId: string;
  let landlordBId: string;
  let renterA1Id: string;
  let renterA2Id: string;
  let property1Id: string;
  let property2Id: string;
  let room1Id: string;
  let room2Id: string;
  let room3Id: string;
  let contract1Id: string;
  let contract2Id: string;
  let meter1Id: string;
  let meter2Id: string;
  let service1Id: string;
  let service2Id: string;
  let invoice1Id: string;
  let invoice2Id: string;
  let line1Id: string;
  let line2Id: string;
  let payment1Id: string;
  let payment2Id: string;
  let support1Id: string;
  let support2Id: string;
  let notif1Id: string;
  let notif2Id: string;

  // Dữ liệu Tenant B (để kiểm chứng cách ly Tenant: B không thấy A)
  let renterB1Id: string;
  let propertyB1Id: string;
  let roomB1Id: string;
  let contractB1Id: string;
  let meterB1Id: string;
  let serviceB1Id: string;
  let invoiceB1Id: string;
  let lineB1Id: string;
  let paymentB1Id: string;
  let supportB1Id: string;
  let notifB1Id: string;

  const dbA1 = () => getTenantDb({ tenantId: tenantAId, userId: renterA1Id, role: 'RENTER' });
  const dbLandlordA = () => getTenantDb({ tenantId: tenantAId, userId: landlordAId, role: 'LANDLORD' });
  const dbB1 = () => getTenantDb({ tenantId: tenantBId, userId: renterB1Id, role: 'RENTER' });
  const dbLandlordB = () => getTenantDb({ tenantId: tenantBId, userId: landlordBId, role: 'LANDLORD' });

  beforeAll(async () => {
    const plan = await prismaSystem.plan.findFirst({ where: { name: 'Cơ bản' } });
    if (!plan) throw new Error('Không tìm thấy gói Cơ bản. Vui lòng chạy seed trước.');
    planId = plan.id;

    const now = new Date();
    const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const tenantA = await prismaSystem.tenant.create({
      data: {
        name: `RLS Matrix A ${ts}`,
        planId,
        status: TenantStatus.ACTIVE,
        subscriptionStart: now,
        subscriptionEnd: nextYear,
      },
    });
    tenantAId = tenantA.id;

    const landlordA = await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: `rls.matrix.landlord.a.${ts}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Chủ trọ Matrix A',
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });
    landlordAId = landlordA.id;

    const renterA1 = await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: `rls.matrix.renter.a1.${ts}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Người thuê Matrix A1',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    renterA1Id = renterA1.id;

    const renterA2 = await prismaSystem.user.create({
      data: {
        tenantId: tenantAId,
        email: `rls.matrix.renter.a2.${ts}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Người thuê Matrix A2',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    renterA2Id = renterA2.id;

    const tenantB = await prismaSystem.tenant.create({
      data: {
        name: `RLS Matrix B ${ts}`,
        planId,
        status: TenantStatus.ACTIVE,
        subscriptionStart: now,
        subscriptionEnd: nextYear,
      },
    });
    tenantBId = tenantB.id;

    const landlordB = await prismaSystem.user.create({
      data: {
        tenantId: tenantBId,
        email: `rls.matrix.landlord.b.${ts}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Chủ trọ Matrix B',
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
      },
    });
    landlordBId = landlordB.id;

    // property1 chứa room1 (hợp đồng A1) và room3 (không hợp đồng); property2 chứa room2 (hợp đồng A2)
    const property1 = await prismaSystem.property.create({
      data: {
        tenantId: tenantAId,
        name: 'Nhà trọ Matrix 1',
        address: '1 Đường Matrix',
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        isActive: true,
      },
    });
    property1Id = property1.id;

    const property2 = await prismaSystem.property.create({
      data: {
        tenantId: tenantAId,
        name: 'Nhà trọ Matrix 2',
        address: '2 Đường Matrix',
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        isActive: true,
      },
    });
    property2Id = property2.id;

    const room1 = await prismaSystem.room.create({
      data: {
        tenantId: tenantAId,
        propertyId: property1Id,
        roomCode: 'M101',
        areaM2: 25,
        basePrice: 3500000,
        status: RoomStatus.OCCUPIED,
      },
    });
    room1Id = room1.id;

    const room2 = await prismaSystem.room.create({
      data: {
        tenantId: tenantAId,
        propertyId: property2Id,
        roomCode: 'M201',
        areaM2: 30,
        basePrice: 4000000,
        status: RoomStatus.OCCUPIED,
      },
    });
    room2Id = room2.id;

    const room3 = await prismaSystem.room.create({
      data: {
        tenantId: tenantAId,
        propertyId: property1Id,
        roomCode: 'M102',
        areaM2: 20,
        basePrice: 3000000,
        status: RoomStatus.AVAILABLE,
      },
    });
    room3Id = room3.id;

    const contract1 = await prismaSystem.contract.create({
      data: {
        tenantId: tenantAId,
        roomId: room1Id,
        renterId: renterA1Id,
        startDate: now,
        endDate: nextYear,
        monthlyRent: 3500000,
        status: ContractStatus.ACTIVE,
      },
    });
    contract1Id = contract1.id;

    const contract2 = await prismaSystem.contract.create({
      data: {
        tenantId: tenantAId,
        roomId: room2Id,
        renterId: renterA2Id,
        startDate: now,
        endDate: nextYear,
        monthlyRent: 4000000,
        status: ContractStatus.ACTIVE,
      },
    });
    contract2Id = contract2.id;

    const meter1 = await prismaSystem.meterReading.create({
      data: {
        tenantId: tenantAId,
        roomId: room1Id,
        billingMonth: month1,
        electricityIndex: 100,
        waterIndex: 50,
        electricityUsage: 30,
        waterUsage: 5,
      },
    });
    meter1Id = meter1.id;

    const meter2 = await prismaSystem.meterReading.create({
      data: {
        tenantId: tenantAId,
        roomId: room2Id,
        billingMonth: month1,
        electricityIndex: 200,
        waterIndex: 80,
        electricityUsage: 40,
        waterUsage: 8,
      },
    });
    meter2Id = meter2.id;

    const service1 = await prismaSystem.service.create({
      data: {
        tenantId: tenantAId,
        propertyId: property1Id,
        name: 'Dịch vụ vệ sinh Matrix 1',
        unit: 'tháng',
        unitPrice: 100000,
        isActive: true,
      },
    });
    service1Id = service1.id;

    const service2 = await prismaSystem.service.create({
      data: {
        tenantId: tenantAId,
        propertyId: property2Id,
        name: 'Dịch vụ vệ sinh Matrix 2',
        unit: 'tháng',
        unitPrice: 120000,
        isActive: true,
      },
    });
    service2Id = service2.id;

    const invoice1 = await prismaSystem.invoice.create({
      data: {
        tenantId: tenantAId,
        contractId: contract1Id,
        meterReadingId: meter1Id,
        billingMonth: month1,
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        rentAmount: 3500000,
        electricityAmount: 105000,
        waterAmount: 100000,
        serviceAmount: 100000,
        totalAmount: 3805000,
        status: InvoiceStatus.UNPAID,
        issueDate: month1,
        dueDate: due1,
      },
    });
    invoice1Id = invoice1.id;

    const invoice2 = await prismaSystem.invoice.create({
      data: {
        tenantId: tenantAId,
        contractId: contract2Id,
        meterReadingId: meter2Id,
        billingMonth: month1,
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        rentAmount: 4000000,
        electricityAmount: 140000,
        waterAmount: 160000,
        serviceAmount: 120000,
        totalAmount: 4420000,
        status: InvoiceStatus.UNPAID,
        issueDate: month2,
        dueDate: due1,
      },
    });
    invoice2Id = invoice2.id;

    const line1 = await prismaSystem.invoiceLineItem.create({
      data: {
        tenantId: tenantAId,
        invoiceId: invoice1Id,
        serviceId: service1Id,
        serviceName: service1.name,
        unit: 'tháng',
        unitPrice: 100000,
        quantity: 1,
        amount: 100000,
      },
    });
    line1Id = line1.id;

    const line2 = await prismaSystem.invoiceLineItem.create({
      data: {
        tenantId: tenantAId,
        invoiceId: invoice2Id,
        serviceId: service2Id,
        serviceName: service2.name,
        unit: 'tháng',
        unitPrice: 120000,
        quantity: 1,
        amount: 120000,
      },
    });
    line2Id = line2.id;

    const payment1 = await prismaSystem.payment.create({
      data: {
        tenantId: tenantAId,
        invoiceId: invoice1Id,
        orderCode: BigInt(ts),
        amount: 3805000,
        status: PaymentStatus.PENDING,
      },
    });
    payment1Id = payment1.id;

    const payment2 = await prismaSystem.payment.create({
      data: {
        tenantId: tenantAId,
        invoiceId: invoice2Id,
        orderCode: BigInt(ts + 1),
        amount: 4420000,
        status: PaymentStatus.PENDING,
      },
    });
    payment2Id = payment2.id;

    const support1 = await prismaSystem.supportRequest.create({
      data: {
        tenantId: tenantAId,
        renterId: renterA1Id,
        type: SupportType.REPAIR,
        title: 'Phản ánh Matrix A1',
        content: 'Máy lạnh hỏng',
        status: SupportStatus.OPEN,
      },
    });
    support1Id = support1.id;

    const support2 = await prismaSystem.supportRequest.create({
      data: {
        tenantId: tenantAId,
        renterId: renterA2Id,
        type: SupportType.COMPLAINT,
        title: 'Phản ánh Matrix A2',
        content: 'Vòi nước rò rỉ',
        status: SupportStatus.OPEN,
      },
    });
    support2Id = support2.id;

    const notif1 = await prismaSystem.notification.create({
      data: {
        tenantId: tenantAId,
        userId: renterA1Id,
        type: 'INVOICE',
        title: 'Hóa đơn Matrix A1',
        content: 'Bạn có hóa đơn mới',
      },
    });
    notif1Id = notif1.id;

    const notif2 = await prismaSystem.notification.create({
      data: {
        tenantId: tenantAId,
        userId: renterA2Id,
        type: 'INVOICE',
        title: 'Hóa đơn Matrix A2',
        content: 'Bạn có hóa đơn mới',
      },
    });
    notif2Id = notif2.id;

    // ---------- Tenant B: mỗi bảng 1 dòng để kiểm chứng cách ly Tenant ----------
    const renterB1 = await prismaSystem.user.create({
      data: {
        tenantId: tenantBId,
        email: `rls.matrix.renter.b1.${ts}@example.com`,
        passwordHash: 'dummy_hash',
        fullName: 'Người thuê Matrix B1',
        role: UserRole.RENTER,
        status: UserStatus.ACTIVE,
      },
    });
    renterB1Id = renterB1.id;

    const propertyB1 = await prismaSystem.property.create({
      data: {
        tenantId: tenantBId,
        name: 'Nhà trọ Matrix B1',
        address: '1 Đường Matrix B',
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        isActive: true,
      },
    });
    propertyB1Id = propertyB1.id;

    const roomB1 = await prismaSystem.room.create({
      data: {
        tenantId: tenantBId,
        propertyId: propertyB1Id,
        roomCode: 'MB101',
        areaM2: 25,
        basePrice: 3500000,
        status: RoomStatus.OCCUPIED,
      },
    });
    roomB1Id = roomB1.id;

    const contractB1 = await prismaSystem.contract.create({
      data: {
        tenantId: tenantBId,
        roomId: roomB1Id,
        renterId: renterB1Id,
        startDate: now,
        endDate: nextYear,
        monthlyRent: 3500000,
        status: ContractStatus.ACTIVE,
      },
    });
    contractB1Id = contractB1.id;

    const meterB1 = await prismaSystem.meterReading.create({
      data: {
        tenantId: tenantBId,
        roomId: roomB1Id,
        billingMonth: month2,
        electricityIndex: 100,
        waterIndex: 50,
        electricityUsage: 30,
        waterUsage: 5,
      },
    });
    meterB1Id = meterB1.id;

    const serviceB1 = await prismaSystem.service.create({
      data: {
        tenantId: tenantBId,
        propertyId: propertyB1Id,
        name: 'Dịch vụ vệ sinh Matrix B1',
        unit: 'tháng',
        unitPrice: 100000,
        isActive: true,
      },
    });
    serviceB1Id = serviceB1.id;

    const invoiceB1 = await prismaSystem.invoice.create({
      data: {
        tenantId: tenantBId,
        contractId: contractB1Id,
        meterReadingId: meterB1Id,
        billingMonth: month2,
        electricityUnitPrice: 3500,
        waterUnitPrice: 20000,
        rentAmount: 3500000,
        electricityAmount: 105000,
        waterAmount: 100000,
        serviceAmount: 100000,
        totalAmount: 3805000,
        status: InvoiceStatus.UNPAID,
        issueDate: month2,
        dueDate: due4,
      },
    });
    invoiceB1Id = invoiceB1.id;

    const lineB1 = await prismaSystem.invoiceLineItem.create({
      data: {
        tenantId: tenantBId,
        invoiceId: invoiceB1Id,
        serviceId: serviceB1Id,
        serviceName: serviceB1.name,
        unit: 'tháng',
        unitPrice: 100000,
        quantity: 1,
        amount: 100000,
      },
    });
    lineB1Id = lineB1.id;

    const paymentB1 = await prismaSystem.payment.create({
      data: {
        tenantId: tenantBId,
        invoiceId: invoiceB1Id,
        orderCode: BigInt(ts + 2),
        amount: 3805000,
        status: PaymentStatus.PENDING,
      },
    });
    paymentB1Id = paymentB1.id;

    const supportB1 = await prismaSystem.supportRequest.create({
      data: {
        tenantId: tenantBId,
        renterId: renterB1Id,
        type: SupportType.REPAIR,
        title: 'Phản ánh Matrix B1',
        content: 'Máy lạnh hỏng',
        status: SupportStatus.OPEN,
      },
    });
    supportB1Id = supportB1.id;

    const notifB1 = await prismaSystem.notification.create({
      data: {
        tenantId: tenantBId,
        userId: renterB1Id,
        type: 'INVOICE',
        title: 'Hóa đơn Matrix B1',
        content: 'Bạn có hóa đơn mới',
      },
    });
    notifB1Id = notifB1.id;
  });

  afterAll(async () => {
    const cleanup = async (tenantId: string) => {
      await prismaSystem.payment.deleteMany({ where: { tenantId } });
      await prismaSystem.invoiceLineItem.deleteMany({ where: { tenantId } });
      await prismaSystem.invoice.deleteMany({ where: { tenantId } });
      await prismaSystem.meterReading.deleteMany({ where: { tenantId } });
      await prismaSystem.contract.deleteMany({ where: { tenantId } });
      await prismaSystem.service.deleteMany({ where: { tenantId } });
      await prismaSystem.room.deleteMany({ where: { tenantId } });
      await prismaSystem.property.deleteMany({ where: { tenantId } });
      await prismaSystem.notification.deleteMany({ where: { tenantId } });
      await prismaSystem.supportRequest.deleteMany({ where: { tenantId } });
      await prismaSystem.auditLog.deleteMany({ where: { tenantId } });
      await prismaSystem.user.deleteMany({ where: { tenantId } });
      await prismaSystem.tenant.delete({ where: { id: tenantId } });
    };
    if (tenantAId) await cleanup(tenantAId);
    if (tenantBId) await cleanup(tenantBId);
    await prismaSystem.$disconnect();
  });

  const cases: TableCase[] = [
    {
      table: 'users',
      delegate: 'user',
      rows: () => ({ ownId: renterA1Id, otherId: renterA2Id, landlordCount: 3 }),
      b: () => ({ renterOwnId: renterB1Id, landlordCount: 2 }),
      insertOutside: (db) =>
        db.user.create({
          data: {
            tenantId: tenantAId,
            email: `rls.matrix.hacker.${ts}@example.com`,
            passwordHash: 'dummy_hash',
            fullName: 'Hacker',
            role: UserRole.RENTER,
            status: UserStatus.ACTIVE,
          },
        }),
      updateOther: (db, id) => db.user.update({ where: { id }, data: { fullName: 'Đã sửa trái phép' } }),
      deleteOther: (db, id) => db.user.delete({ where: { id } }),
    },
    {
      table: 'properties',
      delegate: 'property',
      rows: () => ({ ownId: property1Id, otherId: property2Id, landlordCount: 2 }),
      b: () => ({ renterOwnId: propertyB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.property.create({
          data: {
            tenantId: tenantAId,
            name: 'Nhà trọ gian lận',
            address: '999 Đường X',
            electricityUnitPrice: 3000,
            waterUnitPrice: 15000,
          },
        }),
      updateOther: (db, id) => db.property.update({ where: { id }, data: { electricityUnitPrice: 9999 } }),
      deleteOther: (db, id) => db.property.delete({ where: { id } }),
    },
    {
      table: 'rooms',
      delegate: 'room',
      rows: () => ({ ownId: room1Id, otherId: room2Id, landlordCount: 3 }),
      b: () => ({ renterOwnId: roomB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.room.create({
          data: {
            tenantId: tenantAId,
            propertyId: property2Id,
            roomCode: 'M299',
            areaM2: 18,
            basePrice: 2000000,
          },
        }),
      updateOther: (db, id) => db.room.update({ where: { id }, data: { basePrice: 9999999 } }),
      deleteOther: (db, id) => db.room.delete({ where: { id } }),
    },
    {
      table: 'contracts',
      delegate: 'contract',
      rows: () => ({ ownId: contract1Id, otherId: contract2Id, landlordCount: 2 }),
      b: () => ({ renterOwnId: contractB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.contract.create({
          data: {
            tenantId: tenantAId,
            roomId: room2Id,
            renterId: renterA2Id,
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            monthlyRent: 1,
            status: ContractStatus.ACTIVE,
          },
        }),
      updateOther: (db, id) => db.contract.update({ where: { id }, data: { monthlyRent: 1 } }),
      deleteOther: (db, id) => db.contract.delete({ where: { id } }),
    },
    {
      table: 'meter_readings',
      delegate: 'meterReading',
      rows: () => ({ ownId: meter1Id, otherId: meter2Id, landlordCount: 2 }),
      b: () => ({ renterOwnId: meterB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.meterReading.create({
          data: {
            tenantId: tenantAId,
            roomId: room2Id,
            billingMonth: month3,
            electricityIndex: 1,
            waterIndex: 1,
            electricityUsage: 1,
            waterUsage: 1,
          },
        }),
      updateOther: (db, id) =>
        db.meterReading.update({ where: { id }, data: { electricityIndex: 99999 } }),
      deleteOther: (db, id) => db.meterReading.delete({ where: { id } }),
    },
    {
      table: 'services',
      delegate: 'service',
      rows: () => ({ ownId: service1Id, otherId: service2Id, landlordCount: 2 }),
      b: () => ({ renterOwnId: serviceB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.service.create({
          data: {
            tenantId: tenantAId,
            propertyId: property2Id,
            name: 'Dịch vụ gian lận',
            unit: 'tháng',
            unitPrice: 1,
          },
        }),
      updateOther: (db, id) => db.service.update({ where: { id }, data: { unitPrice: 1 } }),
      deleteOther: (db, id) => db.service.delete({ where: { id } }),
    },
    {
      table: 'invoices',
      delegate: 'invoice',
      rows: () => ({ ownId: invoice1Id, otherId: invoice2Id, landlordCount: 2 }),
      b: () => ({ renterOwnId: invoiceB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.invoice.create({
          data: {
            tenantId: tenantAId,
            contractId: contract2Id,
            meterReadingId: meter2Id,
            billingMonth: month4,
            electricityUnitPrice: 3500,
            waterUnitPrice: 20000,
            rentAmount: 1,
            electricityAmount: 0,
            waterAmount: 0,
            totalAmount: 1,
            status: InvoiceStatus.UNPAID,
            issueDate: month4,
            dueDate: due4,
          },
        }),
      updateOther: (db, id) => db.invoice.update({ where: { id }, data: { totalAmount: 1 } }),
      deleteOther: (db, id) => db.invoice.delete({ where: { id } }),
    },
    {
      table: 'invoice_line_items',
      delegate: 'invoiceLineItem',
      rows: () => ({ ownId: line1Id, otherId: line2Id, landlordCount: 2 }),
      b: () => ({ renterOwnId: lineB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.invoiceLineItem.create({
          data: {
            tenantId: tenantAId,
            invoiceId: invoice2Id,
            serviceId: service2Id,
            serviceName: 'Dịch vụ vệ sinh Matrix 2',
            unit: 'tháng',
            unitPrice: 1,
            quantity: 1,
            amount: 1,
          },
        }),
      updateOther: (db, id) => db.invoiceLineItem.update({ where: { id }, data: { amount: 1 } }),
      deleteOther: (db, id) => db.invoiceLineItem.delete({ where: { id } }),
    },
    {
      table: 'payments',
      delegate: 'payment',
      rows: () => ({ ownId: payment1Id, otherId: payment2Id, landlordCount: 2 }),
      b: () => ({ renterOwnId: paymentB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.payment.create({
          data: {
            tenantId: tenantAId,
            invoiceId: invoice2Id,
            orderCode: BigInt(ts + 2),
            amount: 1,
            status: PaymentStatus.PENDING,
          },
        }),
      updateOther: (db, id) => db.payment.update({ where: { id }, data: { amount: 1 } }),
      deleteOther: (db, id) => db.payment.delete({ where: { id } }),
    },
    {
      table: 'support_requests',
      delegate: 'supportRequest',
      rows: () => ({ ownId: support1Id, otherId: support2Id, landlordCount: 2 }),
      b: () => ({ renterOwnId: supportB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.supportRequest.create({
          data: {
            tenantId: tenantAId,
            renterId: renterA2Id,
            type: SupportType.OTHER,
            title: 'Phản ánh gian lận',
            content: 'Tạo thay người khác',
            status: SupportStatus.OPEN,
          },
        }),
      updateOther: (db, id) =>
        db.supportRequest.update({ where: { id }, data: { status: SupportStatus.RESOLVED } }),
      deleteOther: (db, id) => db.supportRequest.delete({ where: { id } }),
    },
    {
      table: 'notifications',
      delegate: 'notification',
      rows: () => ({ ownId: notif1Id, otherId: notif2Id, landlordCount: 2 }),
      b: () => ({ renterOwnId: notifB1Id, landlordCount: 1 }),
      insertOutside: (db) =>
        db.notification.create({
          data: {
            tenantId: tenantAId,
            userId: renterA2Id,
            type: 'SYSTEM',
            title: 'Thông báo gian lận',
            content: 'Tạo thay người khác',
          },
        }),
      updateOther: (db, id) => db.notification.update({ where: { id }, data: { isRead: true } }),
      deleteOther: (db, id) => db.notification.delete({ where: { id } }),
    },
  ];

  describe.each(cases)(
    'Bảng $table',
    ({ delegate: delegateName, rows, b, insertOutside, updateOther, deleteOther }) => {
      it('Renter A1 SELECT: thấy đúng dòng của mình, không thấy dòng của A2', async () => {
        const { ownId, otherId } = rows();
        const delegate = modelDelegate(dbA1(), delegateName);

        const own = await delegate.findUnique({ where: { id: ownId } });
        expect(own).not.toBeNull();
        expect(own.id).toBe(ownId);

        const other = await delegate.findUnique({ where: { id: otherId } });
        expect(other).toBeNull();

        const all = await delegate.findMany();
        expect(all.map((r: { id: string }) => r.id)).toEqual([ownId]);
      });

      it('Renter A1 UPDATE dòng của A2 bị chặn', async () => {
        const { otherId } = rows();
        await expect(updateOther(dbA1(), otherId)).rejects.toThrow();
      });

      it('Renter A1 DELETE dòng của A2 bị chặn', async () => {
        const { otherId } = rows();
        await expect(deleteOther(dbA1(), otherId)).rejects.toThrow();
      });

      it('Renter A1 INSERT ngoài phạm vi hợp đồng bị chặn (WITH CHECK)', async () => {
        await expect(insertOutside(dbA1())).rejects.toThrow();
      });

      it('Landlord A thấy đủ toàn bộ dòng trong Tenant A', async () => {
        const { landlordCount } = rows();
        const delegate = modelDelegate(dbLandlordA(), delegateName);

        const all = await delegate.findMany();
        expect(all.length).toBe(landlordCount);
      });

      it('Renter B1 SELECT: không thấy dòng của Renter A1 (cách ly Tenant)', async () => {
        const { ownId: aOwnId } = rows();
        const { renterOwnId: bOwnId } = b();
        const delegate = modelDelegate(dbB1(), delegateName);

        const seenA = await delegate.findUnique({ where: { id: aOwnId } });
        expect(seenA).toBeNull();

        const all = await delegate.findMany();
        const ids = all.map((r: { id: string }) => r.id);
        expect(ids).not.toContain(aOwnId);
        expect(ids).toEqual([bOwnId]);
      });

      it('Landlord B SELECT: không thấy dữ liệu Tenant A', async () => {
        const { ownId: aOwnId } = rows();
        const { landlordCount: bLandlordCount } = b();
        const delegate = modelDelegate(dbLandlordB(), delegateName);

        const seenA = await delegate.findUnique({ where: { id: aOwnId } });
        expect(seenA).toBeNull();

        const all = await delegate.findMany();
        const ids = all.map((r: { id: string }) => r.id);
        expect(ids).not.toContain(aOwnId);
        expect(all.length).toBe(bLandlordCount);
      });
    }
  );

  it('Tổng số bảng được kiểm chứng = 11', () => {
    expect(cases.length).toBe(11);
  });
});
