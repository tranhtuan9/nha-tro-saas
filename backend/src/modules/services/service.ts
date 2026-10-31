import { Prisma } from '@prisma/client';
import { getTenantDb, TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import { ServiceListQuery, CreateServiceInput, UpdateServiceInput } from './schema';

const serviceSelect = {
  id: true,
  tenantId: true,
  propertyId: true,
  name: true,
  unit: true,
  unitPrice: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ServiceSelect;

type ServiceRow = Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>;

/**
 * Tiền tệ Decimal (unitPrice) trả JSON dạng string.
 */
function serializeService(service: ServiceRow) {
  return {
    ...service,
    unitPrice: service.unitPrice.toString(),
  };
}

function buildServiceWhere(query: ServiceListQuery): Prisma.ServiceWhereInput {
  const where: Prisma.ServiceWhereInput = {};
  if (query.propertyId) where.propertyId = query.propertyId;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }
  return where;
}

function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

export async function listServices(context: TenantContext, query: ServiceListQuery) {
  const db = getTenantDb(context);
  const where = buildServiceWhere(query);

  const total = await db.service.count({ where });
  const rows = await db.service.findMany({
    where,
    select: serviceSelect,
    orderBy: { createdAt: 'desc' },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    data: rows.map(serializeService),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

/**
 * UC17: tạo dịch vụ. Nhà trọ phải thuộc Tenant (RLS lọc Tenant khác -> 404)
 * và đang hoạt động (400 PROPERTY_INACTIVE).
 */
export async function createService(context: TenantContext, input: CreateServiceInput) {
  const db = getTenantDb(context);

  try {
    return await db.tenantTransaction(async (tx) => {
      const property = await tx.property.findUnique({
        where: { id: input.propertyId },
        select: { id: true, isActive: true },
      });
      // RLS: property của Tenant khác cũng trả về null -> 404 (không phân biệt "không tồn tại").
      if (!property) {
        throw ApiError.notFound('PROPERTY_NOT_FOUND', 'Không tìm thấy nhà trọ');
      }
      if (!property.isActive) {
        throw ApiError.badRequest(
          'PROPERTY_INACTIVE',
          'Nhà trọ đã bị ẩn, không thể thêm dịch vụ mới'
        );
      }

      const service = await tx.service.create({
        data: {
          tenantId: context.tenantId,
          propertyId: input.propertyId,
          name: input.name,
          unit: input.unit,
          unitPrice: input.unitPrice,
          isActive: true,
        },
        select: serviceSelect,
      });

      return serializeService(service);
    });
  } catch (err) {
    // uq_service_property_name: tên duy nhất trong nhà trọ, kể cả dịch vụ đã ngừng.
    if (isUniqueViolation(err)) {
      throw ApiError.conflict(
        'SERVICE_NAME_CONFLICT',
        'Tên dịch vụ đã tồn tại trong nhà trọ này (có thể xung đột với dịch vụ đã ngừng sử dụng)'
      );
    }
    throw err;
  }
}

export async function getService(context: TenantContext, serviceId: string) {
  const db = getTenantDb(context);
  const service = await db.service.findUnique({
    where: { id: serviceId },
    select: serviceSelect,
  });

  if (!service) throw ApiError.notFound('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ');
  return serializeService(service);
}

/**
 * Sửa dịch vụ: chỉ name/unit/unitPrice; KHÔNG đổi propertyId.
 */
export async function updateService(
  context: TenantContext,
  serviceId: string,
  input: UpdateServiceInput
) {
  const db = getTenantDb(context);

  try {
    return await db.tenantTransaction(async (tx) => {
      const existing = await tx.service.findUnique({
        where: { id: serviceId },
        select: { id: true },
      });
      if (!existing) throw ApiError.notFound('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ');

      const service = await tx.service.update({
        where: { id: serviceId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.unit !== undefined && { unit: input.unit }),
          ...(input.unitPrice !== undefined && { unitPrice: input.unitPrice }),
        },
        select: serviceSelect,
      });

      return serializeService(service);
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw ApiError.conflict(
        'SERVICE_NAME_CONFLICT',
        'Tên dịch vụ đã tồn tại trong nhà trọ này (có thể xung đột với dịch vụ đã ngừng sử dụng)'
      );
    }
    throw err;
  }
}

/**
 * Ngừng sử dụng dịch vụ (is_active = false). Idempotent: đã ngừng thì trả trạng thái hiện tại.
 */
export async function deactivateService(context: TenantContext, serviceId: string) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: serviceId },
      select: serviceSelect,
    });
    if (!service) throw ApiError.notFound('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ');

    if (!service.isActive) return serializeService(service);

    const updated = await tx.service.update({
      where: { id: serviceId },
      data: { isActive: false },
      select: serviceSelect,
    });

    return serializeService(updated);
  });
}

/**
 * Bật lại dịch vụ (is_active = true). Idempotent: đang bật thì trả trạng thái hiện tại.
 */
export async function activateService(context: TenantContext, serviceId: string) {
  const db = getTenantDb(context);

  return db.tenantTransaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: serviceId },
      select: serviceSelect,
    });
    if (!service) throw ApiError.notFound('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ');

    if (service.isActive) return serializeService(service);

    const updated = await tx.service.update({
      where: { id: serviceId },
      data: { isActive: true },
      select: serviceSelect,
    });

    return serializeService(updated);
  });
}
