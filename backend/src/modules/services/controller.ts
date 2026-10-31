import { Request, Response } from 'express';
import * as serviceService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import {
  serviceIdParamSchema,
  serviceListQuerySchema,
  createServiceSchema,
  updateServiceSchema,
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
  const query = serviceListQuerySchema.parse(req.query);
  const result = await serviceService.listServices(context, query);
  res.status(200).json(result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = createServiceSchema.parse(req.body);
  const service = await serviceService.createService(context, input);
  res.status(201).json({ message: 'Tạo dịch vụ thành công', data: service });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = serviceIdParamSchema.parse(req.params);
  const service = await serviceService.getService(context, id);
  res.status(200).json({ data: service });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = serviceIdParamSchema.parse(req.params);
  const input = updateServiceSchema.parse(req.body);
  const service = await serviceService.updateService(context, id, input);
  res.status(200).json({ message: 'Cập nhật dịch vụ thành công', data: service });
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = serviceIdParamSchema.parse(req.params);
  const service = await serviceService.deactivateService(context, id);
  res.status(200).json({ message: 'Ngừng sử dụng dịch vụ thành công', data: service });
});

export const activate = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = serviceIdParamSchema.parse(req.params);
  const service = await serviceService.activateService(context, id);
  res.status(200).json({ message: 'Bật lại dịch vụ thành công', data: service });
});
