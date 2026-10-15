import { Request, Response } from 'express';
import * as propertyService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import {
  propertyIdParamSchema,
  propertyListQuerySchema,
  createPropertySchema,
  updatePropertySchema,
} from './schema';

// tenantId/userId/role CHỈ lấy từ JWT đã xác thực (req.user), không lấy từ body/query/params.
function getContext(req: Request): TenantContext {
  const user = req.user;
  if (!user || !user.tenantId) {
    throw ApiError.forbidden('NO_TENANT', 'Tài khoản không thuộc Tenant hợp lệ');
  }
  return { tenantId: user.tenantId, userId: user.userId, role: user.role };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const query = propertyListQuerySchema.parse(req.query);
  const result = await propertyService.listProperties(context, query);
  res.status(200).json(result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = createPropertySchema.parse(req.body);
  const property = await propertyService.createProperty(context, input);
  res.status(201).json({ message: 'Tạo nhà trọ thành công', data: property });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = propertyIdParamSchema.parse(req.params);
  const property = await propertyService.getProperty(context, id);
  res.status(200).json({ data: property });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = propertyIdParamSchema.parse(req.params);
  const input = updatePropertySchema.parse(req.body);
  const property = await propertyService.updateProperty(context, id, input);
  res.status(200).json({ message: 'Cập nhật nhà trọ thành công', data: property });
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = propertyIdParamSchema.parse(req.params);
  const property = await propertyService.deactivateProperty(context, id);
  res.status(200).json({ message: 'Ẩn nhà trọ thành công', data: property });
});
