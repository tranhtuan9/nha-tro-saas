import {
  AuditSource,
  AuditStatus,
  ContractStatus,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RoomStatus,
  SupportStatus,
  SupportType,
  TenantStatus,
  UserRole,
  UserStatus,
  type Contract,
  type Invoice,
  type Property,
  type Service,
  type Tenant,
  type User,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.argv.includes('--yes')) {
  console.error('Lệnh này sẽ xóa toàn bộ dữ liệu hiện có. Chạy bằng: npm run seed:demo');
  process.exit(1);
}

const systemDbUrl = process.env.SYSTEM_DATABASE_URL;
if (!systemDbUrl) {
  throw new Error('SYSTEM_DATABASE_URL chưa được cấu hình trong .env');
}

const prisma = new PrismaClient({ datasourceUrl: systemDbUrl });

const DEMO_PASSWORD = '123456';
const DAY_MS = 24 * 60 * 60 * 1000;
const today = startOfDay(new Date());
let passwordHash = '';
let paymentSequence = 900000n;

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function monthStart(offset = 0): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function nextOrderCode(): bigint {
  const value = paymentSequence;
  paymentSequence += 1n;
  return value;
}

async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany(),
    prisma.invoiceLineItem.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.meterReading.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.supportRequest.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.service.deleteMany(),
    prisma.room.deleteMany(),
    prisma.property.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
    prisma.plan.deleteMany(),
  ]);
}

async function createUser(input: {
  tenantId: string | null;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  nationalId?: string;
  status?: UserStatus;
  lastLoginAt?: Date | null;
}): Promise<User> {
  return prisma.user.create({
    data: {
      tenantId: input.tenantId,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role,
      phone: input.phone ?? null,
      nationalId: input.nationalId ?? null,
      status: input.status ?? UserStatus.ACTIVE,
      lastLoginAt: input.lastLoginAt ?? null,
    },
  });
}

async function createTenant(input: {
  name: string;
  planId: string;
  status: TenantStatus;
  startOffset: number;
  endOffset: number;
}): Promise<Tenant> {
  return prisma.tenant.create({
    data: {
      name: input.name,
      planId: input.planId,
      status: input.status,
      subscriptionStart: addDays(today, input.startOffset),
      subscriptionEnd: addDays(today, input.endOffset),
    },
  });
}

async function createProperty(input: {
  tenantId: string;
  name: string;
  address: string;
  electricityUnitPrice: number;
  waterUnitPrice: number;
  isActive?: boolean;
}): Promise<Property> {
  return prisma.property.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      address: input.address,
      electricityUnitPrice: input.electricityUnitPrice,
      waterUnitPrice: input.waterUnitPrice,
      isActive: input.isActive ?? true,
    },
  });
}

async function createService(
  property: Property,
  name: string,
  unit: string,
  unitPrice: number,
  isActive = true,
): Promise<Service> {
  return prisma.service.create({
    data: {
      tenantId: property.tenantId,
      propertyId: property.id,
      name,
      unit,
      unitPrice,
      isActive,
    },
  });
}

async function createRoom(input: {
  property: Property;
  roomCode: string;
  areaM2: number;
  basePrice: number;
  status: RoomStatus;
  description?: string;
}) {
  return prisma.room.create({
    data: {
      tenantId: input.property.tenantId,
      propertyId: input.property.id,
      roomCode: input.roomCode,
      areaM2: input.areaM2,
      basePrice: input.basePrice,
      status: input.status,
      description: input.description ?? null,
    },
  });
}

async function createContract(input: {
  tenantId: string;
  roomId: string;
  renterId: string;
  startOffset: number;
  endOffset: number;
  monthlyRent: number;
  deposit: number;
  status?: ContractStatus;
  terms?: string;
  terminatedReason?: string;
}): Promise<Contract> {
  return prisma.contract.create({
    data: {
      tenantId: input.tenantId,
      roomId: input.roomId,
      renterId: input.renterId,
      startDate: addDays(today, input.startOffset),
      endDate: addDays(today, input.endOffset),
      monthlyRent: input.monthlyRent,
      deposit: input.deposit,
      status: input.status ?? ContractStatus.ACTIVE,
      terms: input.terms ?? null,
      terminatedReason: input.terminatedReason ?? null,
    },
  });
}

async function createInvoice(input: {
  contract: Contract;
  property: Property;
  monthOffset: number;
  issueDate: Date;
  dueDate: Date;
  electricityUsage: number;
  waterUsage: number;
  services: { service: Service; quantity: number }[];
  status: InvoiceStatus;
  payments?: { status: PaymentStatus; paidAt?: Date }[];
  rentAmountOverride?: number;
}): Promise<Invoice> {
  const billingMonth = monthStart(input.monthOffset);
  const rentAmount = input.rentAmountOverride ?? Number(input.contract.monthlyRent);
  const electricityUnitPrice = Number(input.property.electricityUnitPrice);
  const waterUnitPrice = Number(input.property.waterUnitPrice);
  const electricityAmount = input.electricityUsage * electricityUnitPrice;
  const waterAmount = input.waterUsage * waterUnitPrice;
  const serviceAmount = input.services.reduce(
    (sum, item) => sum + Number(item.service.unitPrice) * item.quantity,
    0,
  );
  const totalAmount = rentAmount + electricityAmount + waterAmount + serviceAmount;

  const reading = await prisma.meterReading.create({
    data: {
      tenantId: input.contract.tenantId,
      roomId: input.contract.roomId,
      billingMonth,
      electricityIndex: 1000 + input.electricityUsage,
      waterIndex: 100 + input.waterUsage,
      electricityUsage: input.electricityUsage,
      waterUsage: input.waterUsage,
      createdAt: input.issueDate,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      tenantId: input.contract.tenantId,
      contractId: input.contract.id,
      meterReadingId: reading.id,
      billingMonth,
      electricityUnitPrice,
      waterUnitPrice,
      rentAmount,
      electricityAmount,
      waterAmount,
      serviceAmount,
      totalAmount,
      status: input.status,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      paidAt: input.status === InvoiceStatus.PAID ? input.payments?.find((p) => p.paidAt)?.paidAt ?? input.issueDate : null,
      createdAt: input.issueDate,
    },
  });

  for (const item of input.services) {
    await prisma.invoiceLineItem.create({
      data: {
        tenantId: input.contract.tenantId,
        invoiceId: invoice.id,
        serviceId: item.service.id,
        serviceName: item.service.name,
        unit: item.service.unit,
        unitPrice: item.service.unitPrice,
        quantity: item.quantity,
        amount: Number(item.service.unitPrice) * item.quantity,
      },
    });
  }

  for (const payment of input.payments ?? []) {
    await prisma.payment.create({
      data: {
        tenantId: input.contract.tenantId,
        invoiceId: invoice.id,
        orderCode: nextOrderCode(),
        amount: totalAmount,
        status: payment.status,
        paidAt: payment.paidAt ?? null,
      },
    });
  }

  return invoice;
}

async function createNotification(input: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  entityId?: string;
  createdAt: Date;
}) {
  return prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      content: input.content,
      isRead: input.isRead,
      entityId: input.entityId ?? null,
      createdAt: input.createdAt,
    },
  });
}

async function createSupportRequest(input: {
  tenantId: string;
  renterId: string;
  type: SupportType;
  title: string;
  content: string;
  status: SupportStatus;
  response?: string;
  respondedAt?: Date;
  createdAt: Date;
}) {
  return prisma.supportRequest.create({
    data: {
      tenantId: input.tenantId,
      renterId: input.renterId,
      type: input.type,
      title: input.title,
      content: input.content,
      status: input.status,
      response: input.response ?? null,
      respondedAt: input.respondedAt ?? null,
      createdAt: input.createdAt,
    },
  });
}

async function createAuditLog(input: {
  tenantId: string;
  userId: string;
  source: AuditSource;
  actionType: string;
  payload: Prisma.InputJsonValue;
  status: AuditStatus;
  createdAt: Date;
  confirmedAt?: Date;
  executedAt?: Date;
}) {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      source: input.source,
      actionType: input.actionType,
      payload: input.payload,
      status: input.status,
      createdAt: input.createdAt,
      confirmedAt: input.confirmedAt ?? null,
      executedAt: input.executedAt ?? null,
    },
  });
}

async function main(): Promise<void> {
  console.log('Đang xóa toàn bộ dữ liệu cũ...');
  await resetDatabase();

  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  const trialDays = parseInt(process.env.TRIAL_DAYS || '14', 10);
  passwordHash = await bcrypt.hash(DEMO_PASSWORD, bcryptRounds);

  const basicPlan = await prisma.plan.create({
    data: {
      name: 'Cơ bản',
      maxProperties: 2,
      maxRooms: 10,
      price: 0,
      durationDays: trialDays,
      isActive: true,
    },
  });
  const advancedPlan = await prisma.plan.create({
    data: {
      name: 'Nâng cao',
      maxProperties: 10,
      maxRooms: 50,
      price: 199000,
      durationDays: 30,
      isActive: true,
    },
  });

  const admin = await createUser({
    tenantId: null,
    email: 'adminnhatro@gmail.com',
    fullName: 'Quản trị viên Demo',
    role: UserRole.ADMIN,
    lastLoginAt: minutesAgo(30),
  });

  const binhMinh = await createTenant({
    name: 'Nhà trọ Bình Minh',
    planId: basicPlan.id,
    status: TenantStatus.ACTIVE,
    startOffset: -60,
    endOffset: 90,
  });
  const hoaMai = await createTenant({
    name: 'Nhà trọ Hoa Mai',
    planId: advancedPlan.id,
    status: TenantStatus.ACTIVE,
    startOffset: -25,
    endOffset: 5,
  });
  const minhAn = await createTenant({
    name: 'Nhà trọ Minh An',
    planId: advancedPlan.id,
    status: TenantStatus.ACTIVE,
    startOffset: -45,
    endOffset: -10,
  });
  const tanPhu = await createTenant({
    name: 'Nhà trọ Tân Phú',
    planId: basicPlan.id,
    status: TenantStatus.SUSPENDED,
    startOffset: -20,
    endOffset: 30,
  });
  const phuQuy = await createTenant({
    name: 'Nhà trọ Phú Quý',
    planId: basicPlan.id,
    status: TenantStatus.ACTIVE,
    startOffset: -1,
    endOffset: 365,
  });

  const binhLandlord = await createUser({
    tenantId: binhMinh.id,
    email: 'nguyenvanbinh@gmail.com',
    fullName: 'Nguyễn Văn Bình',
    role: UserRole.LANDLORD,
    phone: '0901000001',
    nationalId: '001200000001',
    lastLoginAt: minutesAgo(20),
  });
  await createUser({
    tenantId: binhMinh.id,
    email: 'dovankhoa@gmail.com',
    fullName: 'Đỗ Văn Khóa',
    role: UserRole.LANDLORD,
    phone: '0901000002',
    nationalId: '001200000002',
    status: UserStatus.LOCKED,
  });
  const hoaMaiLandlord = await createUser({
    tenantId: hoaMai.id,
    email: 'tranthihoa@gmail.com',
    fullName: 'Trần Thị Hoa',
    role: UserRole.LANDLORD,
    phone: '0902000001',
    nationalId: '001200000101',
    lastLoginAt: addDays(today, -1),
  });
  const minhAnLandlord = await createUser({
    tenantId: minhAn.id,
    email: 'leminhan@gmail.com',
    fullName: 'Lê Minh An',
    role: UserRole.LANDLORD,
    phone: '0903000001',
    nationalId: '001200000201',
    lastLoginAt: addDays(today, -2),
  });
  const tanPhuLandlord = await createUser({
    tenantId: tanPhu.id,
    email: 'phamtanphu@gmail.com',
    fullName: 'Phạm Tấn Phú',
    role: UserRole.LANDLORD,
    phone: '0904000001',
    nationalId: '001200000301',
    lastLoginAt: addDays(today, -5),
  });
  await createUser({
    tenantId: phuQuy.id,
    email: 'vophuquy@gmail.com',
    fullName: 'Võ Phú Quý',
    role: UserRole.LANDLORD,
    phone: '0905000001',
    nationalId: '001200000401',
    lastLoginAt: addDays(today, -3),
  });

  const an = await createUser({
    tenantId: binhMinh.id,
    email: 'nguyenhoaian@gmail.com',
    fullName: 'Nguyễn Hoài An',
    role: UserRole.RENTER,
    phone: '0912000001',
    nationalId: '001200000011',
    lastLoginAt: minutesAgo(60),
  });
  const binh = await createUser({
    tenantId: binhMinh.id,
    email: 'tranthanhbinh@gmail.com',
    fullName: 'Trần Thanh Bình',
    role: UserRole.RENTER,
    phone: '0912000002',
    nationalId: '001200000012',
    lastLoginAt: addDays(today, -2),
  });
  const chi = await createUser({
    tenantId: binhMinh.id,
    email: 'lethichi@gmail.com',
    fullName: 'Lê Thị Chi',
    role: UserRole.RENTER,
    phone: '0912000003',
    nationalId: '001200000013',
    lastLoginAt: addDays(today, -1),
  });
  const dung = await createUser({
    tenantId: binhMinh.id,
    email: 'phamvandung@gmail.com',
    fullName: 'Phạm Văn Dũng',
    role: UserRole.RENTER,
    phone: '0912000004',
    nationalId: '001200000014',
    lastLoginAt: addDays(today, -30),
  });
  const em = await createUser({
    tenantId: binhMinh.id,
    email: 'hoangthiem@gmail.com',
    fullName: 'Hoàng Thị Em',
    role: UserRole.RENTER,
    phone: '0912000005',
    nationalId: '001200000015',
    lastLoginAt: addDays(today, -45),
  });
  const giang = await createUser({
    tenantId: binhMinh.id,
    email: 'nguyentruonggiang@gmail.com',
    fullName: 'Nguyễn Trường Giang',
    role: UserRole.RENTER,
    phone: '0912000006',
    nationalId: '001200000016',
    lastLoginAt: minutesAgo(180),
  });
  const ha = await createUser({
    tenantId: binhMinh.id,
    email: 'buithuha@gmail.com',
    fullName: 'Bùi Thu Hà',
    role: UserRole.RENTER,
    phone: '0912000007',
    nationalId: '001200000017',
  });
  await createUser({
    tenantId: binhMinh.id,
    email: 'ngovankhoa@gmail.com',
    fullName: 'Ngô Văn Khóa',
    role: UserRole.RENTER,
    phone: '0912000008',
    nationalId: '001200000018',
    status: UserStatus.LOCKED,
  });
  const hoa = await createUser({
    tenantId: hoaMai.id,
    email: 'dangthihoa@gmail.com',
    fullName: 'Đặng Thị Hoa',
    role: UserRole.RENTER,
    phone: '0913000001',
    nationalId: '001200000111',
    lastLoginAt: addDays(today, -1),
  });
  const minh = await createUser({
    tenantId: minhAn.id,
    email: 'trinhnhatminh@gmail.com',
    fullName: 'Trịnh Nhật Minh',
    role: UserRole.RENTER,
    phone: '0914000001',
    nationalId: '001200000211',
    lastLoginAt: addDays(today, -2),
  });
  const tan = await createUser({
    tenantId: tanPhu.id,
    email: 'lytan@gmail.com',
    fullName: 'Lý Tấn',
    role: UserRole.RENTER,
    phone: '0915000001',
    nationalId: '001200000311',
    lastLoginAt: addDays(today, -5),
  });

  const binhProperty1 = await createProperty({
    tenantId: binhMinh.id,
    name: 'Bình Minh - Cơ sở 1',
    address: '12 Ngõ 45 Cầu Giấy, Hà Nội',
    electricityUnitPrice: 3500,
    waterUnitPrice: 15000,
  });
  const binhProperty2 = await createProperty({
    tenantId: binhMinh.id,
    name: 'Bình Minh - Cơ sở 2',
    address: '88 Trần Duy Hưng, Hà Nội',
    electricityUnitPrice: 3800,
    waterUnitPrice: 18000,
  });
  const hoaProperty = await createProperty({
    tenantId: hoaMai.id,
    name: 'Hoa Mai - Cơ sở 1',
    address: '25 Lê Văn Việt, TP. Hồ Chí Minh',
    electricityUnitPrice: 3600,
    waterUnitPrice: 16000,
  });
  await createProperty({
    tenantId: hoaMai.id,
    name: 'Hoa Mai - Cơ sở cũ',
    address: '10 Nguyễn Xiển, TP. Hồ Chí Minh',
    electricityUnitPrice: 3600,
    waterUnitPrice: 16000,
    isActive: false,
  });
  const minhProperty = await createProperty({
    tenantId: minhAn.id,
    name: 'Minh An - Cơ sở 1',
    address: '47 Nguyễn Trãi, Hà Nội',
    electricityUnitPrice: 3400,
    waterUnitPrice: 14000,
  });
  const tanProperty = await createProperty({
    tenantId: tanPhu.id,
    name: 'Tân Phú - Cơ sở 1',
    address: '156 Tân Kỳ Tân Quý, TP. Hồ Chí Minh',
    electricityUnitPrice: 3500,
    waterUnitPrice: 15000,
  });

  const p1Internet = await createService(binhProperty1, 'Internet', 'tháng', 100000);
  const p1Parking = await createService(binhProperty1, 'Giữ xe', 'xe', 50000);
  const p1Trash = await createService(binhProperty1, 'Rác', 'người', 20000);
  const p1PayosTest = await createService(binhProperty1, 'Test thanh toán payOS', 'lần', 2000);
  await createService(binhProperty1, 'Nước nóng', 'người', 30000, false);
  const p2Internet = await createService(binhProperty2, 'Internet', 'tháng', 120000);
  const p2Parking = await createService(binhProperty2, 'Giữ xe', 'xe', 50000);
  const hoaInternet = await createService(hoaProperty, 'Internet', 'tháng', 100000);
  const hoaParking = await createService(hoaProperty, 'Giữ xe', 'xe', 50000);
  const minhInternet = await createService(minhProperty, 'Internet', 'tháng', 100000);
  const tanInternet = await createService(tanProperty, 'Internet', 'tháng', 100000);

  const room101 = await createRoom({
    property: binhProperty1,
    roomCode: 'P101',
    areaM2: 25,
    basePrice: 3500000,
    status: RoomStatus.OCCUPIED,
    description: 'Tầng 1, cửa sổ lớn',
  });
  const room102 = await createRoom({
    property: binhProperty1,
    roomCode: 'P102',
    areaM2: 22,
    basePrice: 3200000,
    status: RoomStatus.OCCUPIED,
  });
  const room103 = await createRoom({
    property: binhProperty1,
    roomCode: 'P103',
    areaM2: 30,
    basePrice: 3800000,
    status: RoomStatus.OCCUPIED,
    description: 'Phòng góc, ban công',
  });
  const room104 = await createRoom({
    property: binhProperty1,
    roomCode: 'P104',
    areaM2: 20,
    basePrice: 3000000,
    status: RoomStatus.AVAILABLE,
  });
  const room105 = await createRoom({
    property: binhProperty1,
    roomCode: 'P105',
    areaM2: 20,
    basePrice: 3000000,
    status: RoomStatus.AVAILABLE,
  });
  const room106 = await createRoom({
    property: binhProperty1,
    roomCode: 'P106',
    areaM2: 18,
    basePrice: 2800000,
    status: RoomStatus.MAINTENANCE,
    description: 'Đang sửa hệ thống điện',
  });
  const room201 = await createRoom({
    property: binhProperty2,
    roomCode: 'P201',
    areaM2: 28,
    basePrice: 4000000,
    status: RoomStatus.OCCUPIED,
  });
  const room202 = await createRoom({
    property: binhProperty2,
    roomCode: 'P202',
    areaM2: 26,
    basePrice: 3600000,
    status: RoomStatus.OCCUPIED,
  });
  const room203 = await createRoom({
    property: binhProperty2,
    roomCode: 'P203',
    areaM2: 24,
    basePrice: 3400000,
    status: RoomStatus.AVAILABLE,
  });
  await createRoom({
    property: binhProperty2,
    roomCode: 'P204',
    areaM2: 24,
    basePrice: 3400000,
    status: RoomStatus.AVAILABLE,
  });

  const hoaRoom101 = await createRoom({
    property: hoaProperty,
    roomCode: 'H101',
    areaM2: 25,
    basePrice: 3200000,
    status: RoomStatus.OCCUPIED,
  });
  await createRoom({
    property: hoaProperty,
    roomCode: 'H102',
    areaM2: 25,
    basePrice: 3200000,
    status: RoomStatus.AVAILABLE,
  });
  const minhRoom101 = await createRoom({
    property: minhProperty,
    roomCode: 'M101',
    areaM2: 24,
    basePrice: 3300000,
    status: RoomStatus.OCCUPIED,
  });
  await createRoom({
    property: minhProperty,
    roomCode: 'M102',
    areaM2: 24,
    basePrice: 3300000,
    status: RoomStatus.AVAILABLE,
  });
  const tanRoom101 = await createRoom({
    property: tanProperty,
    roomCode: 'T101',
    areaM2: 22,
    basePrice: 3000000,
    status: RoomStatus.OCCUPIED,
  });
  await createRoom({
    property: tanProperty,
    roomCode: 'T102',
    areaM2: 22,
    basePrice: 3000000,
    status: RoomStatus.MAINTENANCE,
  });

  const contractAn = await createContract({
    tenantId: binhMinh.id,
    roomId: room101.id,
    renterId: an.id,
    startOffset: -180,
    endOffset: 180,
    monthlyRent: 3500000,
    deposit: 3500000,
    terms: 'Thanh toán trước ngày 10 hằng tháng.',
  });
  const contractBinh = await createContract({
    tenantId: binhMinh.id,
    roomId: room102.id,
    renterId: binh.id,
    startOffset: -90,
    endOffset: 5,
    monthlyRent: 3200000,
    deposit: 3200000,
  });
  const contractChi = await createContract({
    tenantId: binhMinh.id,
    roomId: room103.id,
    renterId: chi.id,
    startOffset: -200,
    endOffset: -5,
    monthlyRent: 3800000,
    deposit: 0,
  });
  await createContract({
    tenantId: binhMinh.id,
    roomId: room104.id,
    renterId: dung.id,
    startOffset: -300,
    endOffset: 60,
    monthlyRent: 3000000,
    deposit: 3000000,
    status: ContractStatus.TERMINATED,
    terminatedReason: 'Người thuê chuyển công tác',
  });
  await createContract({
    tenantId: binhMinh.id,
    roomId: room105.id,
    renterId: em.id,
    startOffset: -400,
    endOffset: -30,
    monthlyRent: 3000000,
    deposit: 0,
    status: ContractStatus.ENDED,
  });
  const contractGiang = await createContract({
    tenantId: binhMinh.id,
    roomId: room201.id,
    renterId: giang.id,
    startOffset: -90,
    endOffset: 200,
    monthlyRent: 4000000,
    deposit: 4000000,
  });
  const contractHa = await createContract({
    tenantId: binhMinh.id,
    roomId: room202.id,
    renterId: ha.id,
    startOffset: -60,
    endOffset: 100,
    monthlyRent: 3600000,
    deposit: 3600000,
  });
  const contractHoa = await createContract({
    tenantId: hoaMai.id,
    roomId: hoaRoom101.id,
    renterId: hoa.id,
    startOffset: -100,
    endOffset: 30,
    monthlyRent: 3200000,
    deposit: 3200000,
  });
  const contractMinh = await createContract({
    tenantId: minhAn.id,
    roomId: minhRoom101.id,
    renterId: minh.id,
    startOffset: -45,
    endOffset: 60,
    monthlyRent: 3300000,
    deposit: 3300000,
  });
  const contractTan = await createContract({
    tenantId: tanPhu.id,
    roomId: tanRoom101.id,
    renterId: tan.id,
    startOffset: -120,
    endOffset: 120,
    monthlyRent: 3000000,
    deposit: 3000000,
  });

  const invoiceAnCurrent = await createInvoice({
    contract: contractAn,
    property: binhProperty1,
    monthOffset: 0,
    issueDate: monthStart(0),
    dueDate: addDays(today, 8),
    electricityUsage: 120,
    waterUsage: 6,
    services: [
      { service: p1Internet, quantity: 1 },
      { service: p1Parking, quantity: 1 },
      { service: p1Trash, quantity: 2 },
    ],
    status: InvoiceStatus.UNPAID,
    payments: [{ status: PaymentStatus.PENDING }],
  });
  await createInvoice({
    contract: contractAn,
    property: binhProperty1,
    monthOffset: -1,
    issueDate: monthStart(-1),
    dueDate: addDays(monthStart(-1), 10),
    electricityUsage: 110,
    waterUsage: 5.5,
    services: [
      { service: p1Internet, quantity: 1 },
      { service: p1Parking, quantity: 1 },
    ],
    status: InvoiceStatus.PAID,
    payments: [{ status: PaymentStatus.PAID, paidAt: addDays(today, -20) }],
  });
  await createInvoice({
    contract: contractAn,
    property: binhProperty1,
    monthOffset: -2,
    issueDate: monthStart(-2),
    dueDate: addDays(monthStart(-2), 10),
    electricityUsage: 105,
    waterUsage: 5,
    services: [
      { service: p1Internet, quantity: 1 },
      { service: p1Parking, quantity: 1 },
    ],
    status: InvoiceStatus.OVERDUE,
    payments: [{ status: PaymentStatus.FAILED }],
  });

  await createInvoice({
    contract: contractBinh,
    property: binhProperty1,
    monthOffset: 0,
    issueDate: monthStart(0),
    dueDate: addDays(today, 3),
    electricityUsage: 95,
    waterUsage: 4,
    services: [
      { service: p1Internet, quantity: 1 },
      { service: p1Parking, quantity: 1 },
      { service: p1Trash, quantity: 2 },
    ],
    status: InvoiceStatus.UNPAID,
  });
  const invoiceBinhCancelled = await createInvoice({
    contract: contractBinh,
    property: binhProperty1,
    monthOffset: -1,
    issueDate: monthStart(-1),
    dueDate: addDays(monthStart(-1), 10),
    electricityUsage: 90,
    waterUsage: 4,
    services: [
      { service: p1Internet, quantity: 1 },
      { service: p1Parking, quantity: 1 },
    ],
    status: InvoiceStatus.CANCELLED,
    payments: [{ status: PaymentStatus.CANCELLED }],
  });

  // Hóa đơn riêng 2.000đ để test thanh toán payOS thật (đúng hạn mức tối thiểu).
  await createInvoice({
    contract: contractBinh,
    property: binhProperty1,
    monthOffset: -2,
    issueDate: today,
    dueDate: addDays(today, 30),
    electricityUsage: 0,
    waterUsage: 0,
    services: [{ service: p1PayosTest, quantity: 1 }],
    status: InvoiceStatus.UNPAID,
    rentAmountOverride: 0,
  });

  await createInvoice({
    contract: contractChi,
    property: binhProperty1,
    monthOffset: 0,
    issueDate: monthStart(0),
    dueDate: addDays(today, -10),
    electricityUsage: 130,
    waterUsage: 7,
    services: [
      { service: p1Internet, quantity: 1 },
      { service: p1Parking, quantity: 1 },
      { service: p1Trash, quantity: 1 },
    ],
    status: InvoiceStatus.OVERDUE,
  });
  await createInvoice({
    contract: contractChi,
    property: binhProperty1,
    monthOffset: -1,
    issueDate: monthStart(-1),
    dueDate: addDays(monthStart(-1), 10),
    electricityUsage: 120,
    waterUsage: 6,
    services: [
      { service: p1Internet, quantity: 1 },
      { service: p1Parking, quantity: 1 },
    ],
    status: InvoiceStatus.PAID,
    payments: [{ status: PaymentStatus.PAID, paidAt: addDays(today, -18) }],
  });

  await createInvoice({
    contract: contractGiang,
    property: binhProperty2,
    monthOffset: 0,
    issueDate: monthStart(0),
    dueDate: addDays(today, 10),
    electricityUsage: 150,
    waterUsage: 8,
    services: [
      { service: p2Internet, quantity: 1 },
      { service: p2Parking, quantity: 1 },
    ],
    status: InvoiceStatus.PAID,
    payments: [{ status: PaymentStatus.PAID, paidAt: addDays(today, -2) }],
  });
  await createInvoice({
    contract: contractGiang,
    property: binhProperty2,
    monthOffset: -1,
    issueDate: monthStart(-1),
    dueDate: addDays(monthStart(-1), 10),
    electricityUsage: 140,
    waterUsage: 7,
    services: [
      { service: p2Internet, quantity: 1 },
      { service: p2Parking, quantity: 1 },
    ],
    status: InvoiceStatus.PAID,
    payments: [{ status: PaymentStatus.PAID, paidAt: addDays(today, -22) }],
  });

  const invoiceHa = await createInvoice({
    contract: contractHa,
    property: binhProperty2,
    monthOffset: 0,
    issueDate: monthStart(0),
    dueDate: addDays(today, 6),
    electricityUsage: 88,
    waterUsage: 5,
    services: [
      { service: p2Internet, quantity: 1 },
      { service: p2Parking, quantity: 1 },
    ],
    status: InvoiceStatus.UNPAID,
  });

  const invoiceHoa = await createInvoice({
    contract: contractHoa,
    property: hoaProperty,
    monthOffset: 0,
    issueDate: monthStart(0),
    dueDate: addDays(today, 4),
    electricityUsage: 70,
    waterUsage: 4,
    services: [
      { service: hoaInternet, quantity: 1 },
      { service: hoaParking, quantity: 1 },
    ],
    status: InvoiceStatus.UNPAID,
  });
  await createInvoice({
    contract: contractHoa,
    property: hoaProperty,
    monthOffset: -1,
    issueDate: monthStart(-1),
    dueDate: addDays(monthStart(-1), 10),
    electricityUsage: 65,
    waterUsage: 4,
    services: [
      { service: hoaInternet, quantity: 1 },
      { service: hoaParking, quantity: 1 },
    ],
    status: InvoiceStatus.PAID,
    payments: [{ status: PaymentStatus.PAID, paidAt: addDays(today, -20) }],
  });

  const invoiceMinh = await createInvoice({
    contract: contractMinh,
    property: minhProperty,
    monthOffset: 0,
    issueDate: monthStart(0),
    dueDate: addDays(today, 7),
    electricityUsage: 100,
    waterUsage: 5,
    services: [{ service: minhInternet, quantity: 1 }],
    status: InvoiceStatus.UNPAID,
  });
  await createInvoice({
    contract: contractMinh,
    property: minhProperty,
    monthOffset: -1,
    issueDate: monthStart(-1),
    dueDate: addDays(monthStart(-1), 10),
    electricityUsage: 95,
    waterUsage: 5,
    services: [{ service: minhInternet, quantity: 1 }],
    status: InvoiceStatus.OVERDUE,
  });

  const invoiceTan = await createInvoice({
    contract: contractTan,
    property: tanProperty,
    monthOffset: 0,
    issueDate: monthStart(0),
    dueDate: addDays(today, 5),
    electricityUsage: 60,
    waterUsage: 3,
    services: [{ service: tanInternet, quantity: 1 }],
    status: InvoiceStatus.UNPAID,
  });

  await createSupportRequest({
    tenantId: binhMinh.id,
    renterId: an.id,
    type: SupportType.COMPLAINT,
    title: 'Tiếng ồn ban đêm từ phòng bên cạnh',
    content: 'Sau 23h vẫn có tiếng nhạc lớn, mong chủ trọ nhắc nhở.',
    status: SupportStatus.OPEN,
    createdAt: minutesAgo(120),
  });
  await createSupportRequest({
    tenantId: binhMinh.id,
    renterId: binh.id,
    type: SupportType.REPAIR,
    title: 'Vòi nước nhà vệ sinh bị rò rỉ',
    content: 'Vòi nước chảy liên tục dù đã khóa, cần sửa gấp.',
    status: SupportStatus.IN_PROGRESS,
    response: 'Đã liên hệ thợ, dự kiến kiểm tra trong chiều nay.',
    respondedAt: addDays(today, -1),
    createdAt: addDays(today, -2),
  });
  await createSupportRequest({
    tenantId: binhMinh.id,
    renterId: chi.id,
    type: SupportType.COMPLAINT,
    title: 'Đèn hành lang tầng 2 bị hỏng',
    content: 'Đèn hành lang không sáng vào buổi tối.',
    status: SupportStatus.RESOLVED,
    response: 'Đã thay bóng đèn mới. Cảm ơn bạn đã phản ánh.',
    respondedAt: addDays(today, -4),
    createdAt: addDays(today, -6),
  });
  await createSupportRequest({
    tenantId: binhMinh.id,
    renterId: ha.id,
    type: SupportType.OTHER,
    title: 'Xin cấp lại chìa khóa dự phòng',
    content: 'Tôi muốn đăng ký thêm một chìa khóa dự phòng.',
    status: SupportStatus.OPEN,
    createdAt: addDays(today, -1),
  });
  await createSupportRequest({
    tenantId: hoaMai.id,
    renterId: hoa.id,
    type: SupportType.REPAIR,
    title: 'Máy nóng lạnh không hoạt động',
    content: 'Máy nóng lạnh bật nhưng không nóng.',
    status: SupportStatus.OPEN,
    createdAt: minutesAgo(240),
  });
  await createSupportRequest({
    tenantId: minhAn.id,
    renterId: minh.id,
    type: SupportType.OTHER,
    title: 'Đề nghị xác nhận đã thanh toán',
    content: 'Tôi đã chuyển khoản nhưng hóa đơn chưa cập nhật.',
    status: SupportStatus.RESOLVED,
    response: 'Đã đối chiếu và ghi nhận thanh toán.',
    respondedAt: addDays(today, -3),
    createdAt: addDays(today, -5),
  });

  await createNotification({
    tenantId: binhMinh.id,
    userId: binhLandlord.id,
    type: 'PAYMENT_RECONCILE',
    title: 'Cần đối soát thanh toán',
    content: 'Có giao dịch chuyển khoản chưa khớp với hóa đơn phòng P101.',
    isRead: false,
    entityId: invoiceAnCurrent.id,
    createdAt: minutesAgo(45),
  });
  await createNotification({
    tenantId: binhMinh.id,
    userId: binhLandlord.id,
    type: 'PAYMENT_SUCCESS',
    title: 'Đã nhận thanh toán',
    content: 'Phòng P201 đã thanh toán hóa đơn kỳ này.',
    isRead: true,
    createdAt: addDays(today, -2),
  });
  await createNotification({
    tenantId: binhMinh.id,
    userId: binhLandlord.id,
    type: 'NEW_INVOICE',
    title: 'Hóa đơn tháng này đã phát hành',
    content: 'Đã phát hành hóa đơn cho các phòng đang thuê.',
    isRead: true,
    createdAt: addDays(today, -5),
  });
  await createNotification({
    tenantId: binhMinh.id,
    userId: an.id,
    type: 'NEW_INVOICE',
    title: 'Hóa đơn mới',
    content: 'Hóa đơn tháng này của phòng P101 đã được phát hành.',
    isRead: false,
    entityId: invoiceAnCurrent.id,
    createdAt: addDays(today, -5),
  });
  await createNotification({
    tenantId: binhMinh.id,
    userId: an.id,
    type: 'PAYMENT_SUCCESS',
    title: 'Thanh toán thành công',
    content: 'Hóa đơn tháng trước của phòng P101 đã được ghi nhận thanh toán.',
    isRead: true,
    createdAt: addDays(today, -20),
  });
  await createNotification({
    tenantId: binhMinh.id,
    userId: binh.id,
    type: 'NEW_INVOICE',
    title: 'Hóa đơn mới',
    content: 'Hóa đơn tháng này của phòng P102 đã được phát hành.',
    isRead: false,
    createdAt: addDays(today, -5),
  });
  await createNotification({
    tenantId: binhMinh.id,
    userId: chi.id,
    type: 'PAYMENT_AMOUNT_MISMATCH',
    title: 'Hóa đơn quá hạn',
    content: 'Hóa đơn phòng P103 đã quá hạn thanh toán.',
    isRead: false,
    createdAt: minutesAgo(300),
  });
  await createNotification({
    tenantId: binhMinh.id,
    userId: giang.id,
    type: 'PAYMENT_SUCCESS',
    title: 'Thanh toán thành công',
    content: 'Hóa đơn phòng P201 đã được thanh toán.',
    isRead: false,
    createdAt: addDays(today, -2),
  });
  await createNotification({
    tenantId: binhMinh.id,
    userId: ha.id,
    type: 'NEW_INVOICE',
    title: 'Hóa đơn mới',
    content: 'Hóa đơn tháng này của phòng P202 đã được phát hành.',
    isRead: false,
    entityId: invoiceHa.id,
    createdAt: addDays(today, -5),
  });
  await createNotification({
    tenantId: hoaMai.id,
    userId: hoaMaiLandlord.id,
    type: 'NEW_INVOICE',
    title: 'Hóa đơn tháng này đã phát hành',
    content: 'Hóa đơn phòng H101 đã được phát hành.',
    isRead: false,
    createdAt: addDays(today, -5),
  });
  await createNotification({
    tenantId: hoaMai.id,
    userId: hoa.id,
    type: 'NEW_INVOICE',
    title: 'Hóa đơn mới',
    content: 'Hóa đơn tháng này của phòng H101 đã được phát hành.',
    isRead: false,
    entityId: invoiceHoa.id,
    createdAt: addDays(today, -5),
  });
  await createNotification({
    tenantId: minhAn.id,
    userId: minhAnLandlord.id,
    type: 'PAYMENT_RECONCILE',
    title: 'Hóa đơn quá hạn chưa thu',
    content: 'Hóa đơn tháng trước của phòng M101 vẫn chưa được thanh toán.',
    isRead: false,
    createdAt: addDays(today, -8),
  });
  await createNotification({
    tenantId: minhAn.id,
    userId: minh.id,
    type: 'NEW_INVOICE',
    title: 'Hóa đơn mới',
    content: 'Hóa đơn tháng này của phòng M101 đã được phát hành.',
    isRead: false,
    entityId: invoiceMinh.id,
    createdAt: addDays(today, -5),
  });
  await createNotification({
    tenantId: tanPhu.id,
    userId: tanPhuLandlord.id,
    type: 'SYSTEM',
    title: 'Hệ thống tạm ngưng',
    content: 'Hệ thống nhà trọ đang bị tạm ngưng. Vui lòng liên hệ quản trị viên.',
    isRead: false,
    createdAt: addDays(today, -1),
  });
  await createNotification({
    tenantId: tanPhu.id,
    userId: tan.id,
    type: 'NEW_INVOICE',
    title: 'Hóa đơn mới',
    content: 'Hóa đơn tháng này của phòng T101 đã được phát hành.',
    isRead: false,
    entityId: invoiceTan.id,
    createdAt: addDays(today, -5),
  });

  await createAuditLog({
    tenantId: binhMinh.id,
    userId: binhLandlord.id,
    source: AuditSource.AI,
    actionType: 'createInvoice',
    payload: {
      params: {
        contractId: contractGiang.id,
        billingMonth: monthStart(1).toISOString().slice(0, 10),
        services: [{ serviceId: p2Internet.id, quantity: 1 }],
      },
      preview: {
        contractId: contractGiang.id,
        meterReadingId: '',
        billingMonth: monthStart(1).toISOString().slice(0, 10),
        effectiveStatus: 'UNPAID',
        electricityUnitPrice: '3800',
        waterUnitPrice: '18000',
        rentAmount: '4000000',
        electricityAmount: '0',
        waterAmount: '0',
        serviceAmount: '120000',
        totalAmount: '4120000',
        issueDate: monthStart(1).toISOString().slice(0, 10),
        dueDate: addDays(monthStart(1), 10).toISOString().slice(0, 10),
        room: { id: room201.id, roomCode: 'P201', propertyId: binhProperty2.id },
        renter: { id: giang.id, fullName: giang.fullName },
        lineItems: [
          {
            serviceId: p2Internet.id,
            serviceName: p2Internet.name,
            unit: p2Internet.unit,
            unitPrice: '120000',
            quantity: '1',
            amount: '120000',
          },
        ],
      },
      expiresAt: addDays(today, 1).toISOString(),
    },
    status: AuditStatus.PROPOSED,
    createdAt: minutesAgo(10),
  });
  await createAuditLog({
    tenantId: binhMinh.id,
    userId: binhLandlord.id,
    source: AuditSource.AI,
    actionType: 'createInvoice',
    payload: {
      params: {
        contractId: contractHa.id,
        billingMonth: monthStart(0).toISOString().slice(0, 10),
        services: [{ serviceId: p2Internet.id, quantity: 1 }],
      },
      expiresAt: minutesAgo(45).toISOString(),
    },
    status: AuditStatus.PROPOSED,
    createdAt: minutesAgo(60),
  });
  await createAuditLog({
    tenantId: binhMinh.id,
    userId: binhLandlord.id,
    source: AuditSource.AI,
    actionType: 'createInvoice',
    payload: {
      params: { contractId: contractAn.id, billingMonth: monthStart(-1).toISOString().slice(0, 10) },
    },
    status: AuditStatus.EXECUTED,
    createdAt: addDays(today, -25),
    confirmedAt: addDays(today, -25),
    executedAt: addDays(today, -25),
  });
  await createAuditLog({
    tenantId: binhMinh.id,
    userId: binhLandlord.id,
    source: AuditSource.AI,
    actionType: 'setRoomStatus',
    payload: { params: { roomId: room106.id, status: 'MAINTENANCE' } },
    status: AuditStatus.REJECTED,
    createdAt: addDays(today, -3),
  });
  await createAuditLog({
    tenantId: binhMinh.id,
    userId: binhLandlord.id,
    source: AuditSource.AI,
    actionType: 'createContract',
    payload: { params: { roomId: room203.id, renterId: em.id } },
    status: AuditStatus.FAILED,
    createdAt: addDays(today, -4),
  });
  await createAuditLog({
    tenantId: binhMinh.id,
    userId: binhLandlord.id,
    source: AuditSource.USER,
    actionType: 'cancelInvoice',
    payload: { invoiceId: invoiceBinhCancelled.id, reason: 'Tạo nhầm kỳ hóa đơn' },
    status: AuditStatus.EXECUTED,
    createdAt: addDays(today, -7),
    confirmedAt: addDays(today, -7),
    executedAt: addDays(today, -7),
  });
  await createAuditLog({
    tenantId: hoaMai.id,
    userId: hoaMaiLandlord.id,
    source: AuditSource.AI,
    actionType: 'createInvoice',
    payload: { params: { contractId: contractHoa.id, billingMonth: monthStart(1).toISOString().slice(0, 10) } },
    status: AuditStatus.CONFIRMED,
    createdAt: addDays(today, -2),
    confirmedAt: addDays(today, -2),
  });

  console.log('Đã tạo lại toàn bộ dữ liệu demo.');
  console.log(`Mật khẩu chung: ${DEMO_PASSWORD}`);
  console.table([
    { email: admin.email, vaiTro: 'ADMIN', tenant: '-', ghiChu: 'Quản trị hệ thống' },
    { email: 'nguyenvanbinh@gmail.com', vaiTro: 'LANDLORD', tenant: binhMinh.name, ghiChu: 'Đủ dữ liệu, chạm giới hạn gói Cơ bản' },
    { email: 'dovankhoa@gmail.com', vaiTro: 'LANDLORD', tenant: binhMinh.name, ghiChu: 'Tài khoản bị khóa' },
    { email: 'tranthihoa@gmail.com', vaiTro: 'LANDLORD', tenant: hoaMai.name, ghiChu: 'Gói sắp hết hạn (5 ngày)' },
    { email: 'leminhan@gmail.com', vaiTro: 'LANDLORD', tenant: minhAn.name, ghiChu: 'Gói đã hết hạn' },
    { email: 'phamtanphu@gmail.com', vaiTro: 'LANDLORD', tenant: tanPhu.name, ghiChu: 'Tenant bị tạm ngưng' },
    { email: 'vophuquy@gmail.com', vaiTro: 'LANDLORD', tenant: phuQuy.name, ghiChu: 'Tenant mới, chưa có dữ liệu' },
    { email: 'nguyenhoaian@gmail.com', vaiTro: 'RENTER', tenant: binhMinh.name, ghiChu: 'Hợp đồng hiệu lực, có hóa đơn chờ thu' },
    { email: 'tranthanhbinh@gmail.com', vaiTro: 'RENTER', tenant: binhMinh.name, ghiChu: 'Hợp đồng sắp hết hạn' },
    { email: 'lethichi@gmail.com', vaiTro: 'RENTER', tenant: binhMinh.name, ghiChu: 'Hợp đồng quá ngày kết thúc, hóa đơn quá hạn' },
    { email: 'phamvandung@gmail.com', vaiTro: 'RENTER', tenant: binhMinh.name, ghiChu: 'Hợp đồng đã chấm dứt' },
    { email: 'hoangthiem@gmail.com', vaiTro: 'RENTER', tenant: binhMinh.name, ghiChu: 'Hợp đồng đã kết thúc' },
    { email: 'nguyentruonggiang@gmail.com', vaiTro: 'RENTER', tenant: binhMinh.name, ghiChu: 'Hóa đơn đã thanh toán' },
    { email: 'buithuha@gmail.com', vaiTro: 'RENTER', tenant: binhMinh.name, ghiChu: 'Chưa từng đăng nhập' },
    { email: 'ngovankhoa@gmail.com', vaiTro: 'RENTER', tenant: binhMinh.name, ghiChu: 'Tài khoản bị khóa' },
    { email: 'dangthihoa@gmail.com', vaiTro: 'RENTER', tenant: hoaMai.name, ghiChu: 'Tenant sắp hết hạn' },
    { email: 'trinhnhatminh@gmail.com', vaiTro: 'RENTER', tenant: minhAn.name, ghiChu: 'Tenant đã hết hạn' },
    { email: 'lytan@gmail.com', vaiTro: 'RENTER', tenant: tanPhu.name, ghiChu: 'Tenant bị tạm ngưng' },
  ]);
}

main()
  .catch((error) => {
    console.error('Lỗi khi tạo dữ liệu demo:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
