import { Prisma, ContractStatus } from '@prisma/client';
import { getTenantDb, TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import { PropertyListQuery, CreatePropertyInput, UpdatePropertyInput } from './schema';

const propertySelect = {
  id: true,
  tenantId: true,
  name: true,
  address: true,
  description: true,
  electricityUnitPrice: true,
  waterUnitPrice: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.PropertySelect;

type PropertyRow = Prisma.PropertyGetPayload<{ select: typeof propertySelect }>;

/**
 * Q2: các trường tiền tệ Decimal được trả về dạng string để tránh sai số khi qua JSON.
 */
function serializeProperty(property: PropertyRow) {
  return {
    ...property,
    electricityUnitPrice: property.electricityUnitPrice.toString(),
    waterUnitPrice: property.waterUnitPrice.toString(),
  };
}

function buildPropertyWhere(query: PropertyListQuery): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {};
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { address: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }
  return where;
}

/**
 * Khóa dòng Tenant để tuần tự hóa bước kiểm tra giới hạn gói + INSERT (tránh race condition).
 * app_user có GRANT UPDATE ON tenants và policy tenant_self_isolation_policy (FOR ALL) cho
 * phép khóa chính dòng Tenant của mình, nên dùng được FOR UPDATE mà KHÔNG cần prismaSystem.
 */
async function lockTenantRow(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
}

export async function listProperties(context: TenantContext, query: PropertyListQuery) {
  const db = getTenantDb(context);
  const where = buildPropertyWhere(query);

  const total = await db.property.count({ where });
  const rows = await db.property.findMany({
    where,
    select: propertySelect,
    orderBy: { createdAt: 'desc' },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    data: rows.map(serializeProperty),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function createProperty(context: TenantContext, input: CreatePropertyInput) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    await lockTenantRow(tx, context.tenantId);

    const tenant = await tx.tenant.findUnique({
      where: { id: context.tenantId },
      include: { plan: true },
    });
    if (!tenant) throw ApiError.notFound('TENANT_NOT_FOUND', 'Không tìm thấy Tenant');
    if (!tenant.plan) {
      throw ApiError.notFound('PLAN_NOT_FOUND', 'Không tìm thấy gói dịch vụ của Tenant');
    }

    const activeCount = await tx.property.count({
      where: { tenantId: context.tenantId, isActive: true },
    });
    if (activeCount >= tenant.plan.maxProperties) {
      throw ApiError.forbidden(
        'PLAN_LIMIT_REACHED',
        `Bạn đã đạt giới hạn tối đa số nhà trọ (${tenant.plan.maxProperties}) của gói ${tenant.plan.name}. Vui lòng nâng cấp gói để tạo thêm.`
      );
    }

    const property = await tx.property.create({
      data: {
        tenantId: context.tenantId,
        name: input.name,
        address: input.address,
        description: input.description ?? null,
        electricityUnitPrice: input.electricityUnitPrice,
        waterUnitPrice: input.waterUnitPrice,
        isActive: true,
      },
      select: propertySelect,
    });

    return serializeProperty(property);
  });
}

export async function getProperty(context: TenantContext, propertyId: string) {
  const db = getTenantDb(context);
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: propertySelect,
  });

  if (!property) throw ApiError.notFound('PROPERTY_NOT_FOUND', 'Không tìm thấy nhà trọ');
  return serializeProperty(property);
}

export async function updateProperty(
  context: TenantContext,
  propertyId: string,
  input: UpdatePropertyInput
) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const existing = await tx.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound('PROPERTY_NOT_FOUND', 'Không tìm thấy nhà trọ');

    const property = await tx.property.update({
      where: { id: propertyId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.electricityUnitPrice !== undefined && {
          electricityUnitPrice: input.electricityUnitPrice,
        }),
        ...(input.waterUnitPrice !== undefined && { waterUnitPrice: input.waterUnitPrice }),
      },
      select: propertySelect,
    });

    return serializeProperty(property);
  });
}

export async function deactivateProperty(context: TenantContext, propertyId: string) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const property = await tx.property.findUnique({
      where: { id: propertyId },
      select: propertySelect,
    });
    if (!property) throw ApiError.notFound('PROPERTY_NOT_FOUND', 'Không tìm thấy nhà trọ');

    // Idempotent: nhà trọ đã ẩn thì trả về trạng thái hiện tại.
    if (!property.isActive) return serializeProperty(property);

    const activeContract = await tx.contract.findFirst({
      where: { status: ContractStatus.ACTIVE, room: { propertyId } },
      select: { id: true },
    });
    if (activeContract) {
      throw ApiError.conflict(
        'PROPERTY_HAS_ACTIVE_CONTRACT',
        'Không thể ẩn nhà trọ đang có hợp đồng hiệu lực'
      );
    }

    const updated = await tx.property.update({
      where: { id: propertyId },
      data: { isActive: false },
      select: propertySelect,
    });

    return serializeProperty(updated);
  });
}
