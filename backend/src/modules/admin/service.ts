import { prismaSystem } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';
import {
  PaginationQuery,
  TenantListQuery,
  UpdatePlanInput,
  CreatePlanInput,
  ChangeTenantPlanInput,
} from './schema';

const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  tenantId: true,
  lastLoginAt: true,
  createdAt: true,
};

function buildPagination(query: { page?: number; pageSize?: number }) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

function computeSubscriptionStatus(subscriptionEnd: Date): 'active' | 'expiring_soon' | 'expired' {
  const now = new Date();
  const daysLeft = Math.ceil((subscriptionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'expiring_soon';
  return 'active';
}

export async function listUsers(query: PaginationQuery) {
  const { skip, take, page, pageSize } = buildPagination(query);

  const where: any = {};
  if (query.status) where.status = query.status as UserStatus;
  if (query.role) where.role = query.role as UserRole;
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { fullName: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await prismaSystem.$transaction([
    prismaSystem.user.count({ where }),
    prismaSystem.user.findMany({
      where,
      select: {
        ...safeUserSelect,
        tenant: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    data: users,
    pagination: { page, pageSize, total },
  };
}

export async function lockUser(userId: string, adminId: string) {
  if (userId === adminId) {
    throw ApiError.badRequest('CANNOT_LOCK_SELF', 'Không thể khóa tài khoản của chính mình');
  }

  const user = await prismaSystem.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'Không tìm thấy người dùng');
  if (user.role === UserRole.ADMIN) {
    throw ApiError.badRequest('CANNOT_LOCK_ADMIN', 'Không thể khóa tài khoản Admin');
  }

  // Idempotent: nếu đã LOCKED, trả về trạng thái hiện tại (200)
  return prismaSystem.user.update({
    where: { id: userId },
    data: { status: UserStatus.LOCKED },
    select: safeUserSelect,
  });
}

export async function unlockUser(userId: string) {
  const user = await prismaSystem.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'Không tìm thấy người dùng');

  // Idempotent: nếu đã ACTIVE, trả về trạng thái hiện tại (200)
  return prismaSystem.user.update({
    where: { id: userId },
    data: { status: UserStatus.ACTIVE },
    select: safeUserSelect,
  });
}

export async function listTenants(query: TenantListQuery) {
  const { skip, take, page, pageSize } = buildPagination(query);

  const where: any = {};
  if (query.status) where.status = query.status as TenantStatus;
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }

  const [total, tenants] = await prismaSystem.$transaction([
    prismaSystem.tenant.count({ where }),
    prismaSystem.tenant.findMany({
      where,
      include: {
        plan: { select: { id: true, name: true, price: true } },
        _count: { select: { users: true, properties: true, rooms: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  let filtered = tenants;
  if (query.subscriptionStatus) {
    filtered = tenants.filter((t: any) => {
      const status = computeSubscriptionStatus(t.subscriptionEnd);
      return status === query.subscriptionStatus;
    });
  }

  const data = filtered.map((t: any) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    subscriptionStart: t.subscriptionStart,
    subscriptionEnd: t.subscriptionEnd,
    subscriptionStatus: computeSubscriptionStatus(t.subscriptionEnd),
    plan: t.plan,
    counts: {
      users: t._count.users,
      properties: t._count.properties,
      rooms: t._count.rooms,
    },
  }));

  return {
    data,
    pagination: { page, pageSize, total },
  };
}

export async function getTenant(tenantId: string) {
  const tenant = await prismaSystem.tenant.findUnique({
    where: { id: tenantId },
    include: {
      plan: { select: { id: true, name: true, price: true, maxProperties: true, maxRooms: true } },
      _count: { select: { users: true, properties: true, rooms: true } },
    },
  });

  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Không tìm thấy Tenant');

  const { _count, ...tenantData } = tenant;

  return {
    ...tenantData,
    subscriptionStatus: computeSubscriptionStatus(tenant.subscriptionEnd),
    counts: {
      users: _count.users,
      properties: _count.properties,
      rooms: _count.rooms,
    },
  };
}

export async function suspendTenant(tenantId: string) {
  const tenant = await prismaSystem.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Không tìm thấy Tenant');

  // Idempotent: nếu đã SUSPENDED, trả về trạng thái hiện tại (200)
  return prismaSystem.tenant.update({
    where: { id: tenantId },
    data: { status: TenantStatus.SUSPENDED },
  });
}

export async function activateTenant(tenantId: string) {
  const tenant = await prismaSystem.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Không tìm thấy Tenant');

  // Idempotent: nếu đã ACTIVE, trả về trạng thái hiện tại (200)
  return prismaSystem.tenant.update({
    where: { id: tenantId },
    data: { status: TenantStatus.ACTIVE },
  });
}

export async function listPlans() {
  return prismaSystem.plan.findMany({
    orderBy: { price: 'asc' },
    include: { _count: { select: { tenants: true } } },
  });
}

export async function createPlan(input: CreatePlanInput) {
  return prismaSystem.plan.create({
    data: {
      name: input.name,
      maxProperties: input.maxProperties,
      maxRooms: input.maxRooms,
      price: input.price,
      durationDays: input.durationDays,
      isActive: true,
    },
  });
}

export async function updatePlan(planId: string, input: UpdatePlanInput) {
  const plan = await prismaSystem.plan.findUnique({ where: { id: planId } });
  if (!plan) throw ApiError.notFound('PLAN_NOT_FOUND', 'Không tìm thấy gói dịch vụ');

  return prismaSystem.plan.update({
    where: { id: planId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.maxProperties !== undefined && { maxProperties: input.maxProperties }),
      ...(input.maxRooms !== undefined && { maxRooms: input.maxRooms }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.durationDays !== undefined && { durationDays: input.durationDays }),
    },
  });
}

export async function deactivatePlan(planId: string) {
  const plan = await prismaSystem.plan.findUnique({
    where: { id: planId },
    include: { _count: { select: { tenants: true } } },
  });
  if (!plan) throw ApiError.notFound('PLAN_NOT_FOUND', 'Không tìm thấy gói dịch vụ');

  // Idempotent: nếu đã ẩn, trả về trạng thái hiện tại (200)
  if (!plan.isActive) return plan;

  const defaultPlanName = process.env.DEFAULT_PLAN_NAME || 'Cơ bản';
  if (plan.name === defaultPlanName) {
    throw ApiError.badRequest('CANNOT_DEACTIVATE_DEFAULT_PLAN', 'Không thể ẩn gói mặc định');
  }

  if (plan._count.tenants > 0) {
    throw ApiError.badRequest('PLAN_IN_USE', 'Không thể ẩn gói đang có Tenant sử dụng');
  }

  return prismaSystem.plan.update({
    where: { id: planId },
    data: { isActive: false },
  });
}

export async function changeTenantPlan(tenantId: string, input: ChangeTenantPlanInput) {
  const tenant = await prismaSystem.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });
  if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Không tìm thấy Tenant');

  const plan = await prismaSystem.plan.findUnique({ where: { id: input.planId } });
  if (!plan) throw ApiError.notFound('PLAN_NOT_FOUND', 'Không tìm thấy gói dịch vụ');
  if (!plan.isActive) throw ApiError.badRequest('PLAN_INACTIVE', 'Gói dịch vụ đã bị ẩn');

  const now = new Date();
  let subscriptionEnd: Date;

  if (input.subscriptionEnd) {
    subscriptionEnd = input.subscriptionEnd;
  } else if (input.extendDays) {
    const base = tenant.subscriptionEnd > now ? tenant.subscriptionEnd : now;
    subscriptionEnd = new Date(base.getTime() + input.extendDays * 24 * 60 * 60 * 1000);
  } else {
    subscriptionEnd = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
  }

  const warnings: string[] = [];

  const propertyCount = await prismaSystem.property.count({
    where: { tenantId, isActive: true },
  });
  if (propertyCount > plan.maxProperties) {
    warnings.push(`Tenant đang có ${propertyCount} nhà trọ, vượt quá giới hạn ${plan.maxProperties} của gói mới`);
  }

  const roomCount = await prismaSystem.room.count({
    where: { tenantId },
  });
  if (roomCount > plan.maxRooms) {
    warnings.push(`Tenant đang có ${roomCount} phòng, vượt quá giới hạn ${plan.maxRooms} của gói mới`);
  }

  const updated = await prismaSystem.tenant.update({
    where: { id: tenantId },
    data: {
      planId: plan.id,
      subscriptionStart: now,
      subscriptionEnd,
    },
  });

  return { tenant: updated, warnings };
}
