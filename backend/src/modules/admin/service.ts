import { prismaSystem } from '../../lib/db';
import { UserRole, UserStatus, TenantStatus } from '@prisma/client';
import {
  PaginationQuery,
  UpdatePlanInput,
  ChangeTenantPlanInput,
} from './schema';

const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  nationalId: true,
  role: true,
  status: true,
  tenantId: true,
  lastLoginAt: true,
  createdAt: true,
};

function buildPagination(query: PaginationQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export async function listUsers(query: PaginationQuery) {
  const { skip, take, page, pageSize } = buildPagination(query);

  const where: any = {};
  if (query.status) where.status = query.status as UserStatus;
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

export async function lockUser(userId: string) {
  const user = await prismaSystem.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Không tìm thấy người dùng');
  if (user.role === UserRole.ADMIN) throw new Error('Không thể khóa tài khoản Admin');
  if (user.status === UserStatus.LOCKED) throw new Error('Tài khoản đã bị khóa');

  return prismaSystem.user.update({
    where: { id: userId },
    data: { status: UserStatus.LOCKED },
    select: safeUserSelect,
  });
}

export async function unlockUser(userId: string) {
  const user = await prismaSystem.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Không tìm thấy người dùng');
  if (user.status !== UserStatus.LOCKED) throw new Error('Tài khoản không bị khóa');

  return prismaSystem.user.update({
    where: { id: userId },
    data: { status: UserStatus.ACTIVE },
    select: safeUserSelect,
  });
}

export async function listTenants(query: PaginationQuery) {
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
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    data: tenants,
    pagination: { page, pageSize, total },
  };
}

export async function suspendTenant(tenantId: string) {
  const tenant = await prismaSystem.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Không tìm thấy Tenant');
  if (tenant.status === TenantStatus.SUSPENDED) throw new Error('Tenant đã bị tạm ngưng');

  return prismaSystem.tenant.update({
    where: { id: tenantId },
    data: { status: TenantStatus.SUSPENDED },
  });
}

export async function activateTenant(tenantId: string) {
  const tenant = await prismaSystem.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Không tìm thấy Tenant');
  if (tenant.status === TenantStatus.ACTIVE) throw new Error('Tenant đang hoạt động');

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

export async function updatePlan(planId: string, input: UpdatePlanInput) {
  const plan = await prismaSystem.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error('Không tìm thấy gói dịch vụ');

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
  if (!plan) throw new Error('Không tìm thấy gói dịch vụ');
  if (!plan.isActive) throw new Error('Gói đã bị ẩn');
  if (plan._count.tenants > 0) {
    throw new Error('Không thể ẩn gói đang có Tenant sử dụng');
  }

  return prismaSystem.plan.update({
    where: { id: planId },
    data: { isActive: false },
  });
}

export async function changeTenantPlan(tenantId: string, input: ChangeTenantPlanInput) {
  const tenant = await prismaSystem.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Không tìm thấy Tenant');

  const plan = await prismaSystem.plan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new Error('Không tìm thấy gói dịch vụ');
  if (!plan.isActive) throw new Error('Gói dịch vụ đã bị ẩn');

  const now = new Date();
  let subscriptionEnd: Date;

  if (input.extendDays) {
    const base = tenant.subscriptionEnd > now ? tenant.subscriptionEnd : now;
    subscriptionEnd = new Date(base.getTime() + input.extendDays * 24 * 60 * 60 * 1000);
  } else {
    subscriptionEnd = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
  }

  return prismaSystem.tenant.update({
    where: { id: tenantId },
    data: {
      planId: plan.id,
      subscriptionStart: now,
      subscriptionEnd,
    },
  });
}
