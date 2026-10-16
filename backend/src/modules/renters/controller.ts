import { Request, Response } from 'express';
import * as renterService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import {
  renterIdParamSchema,
  renterListQuerySchema,
  createRenterSchema,
  updateRenterSchema,
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
  const query = renterListQuerySchema.parse(req.query);
  const result = await renterService.listRenters(context, query);
  res.status(200).json(result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = createRenterSchema.parse(req.body);
  const result = await renterService.createRenter(context, input);
  res.status(201).json({ message: 'Tạo người thuê thành công', data: result });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = renterIdParamSchema.parse(req.params);
  const renter = await renterService.getRenter(context, id);
  res.status(200).json({ data: renter });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = renterIdParamSchema.parse(req.params);
  const input = updateRenterSchema.parse(req.body);
  const renter = await renterService.updateRenter(context, id, input);
  res.status(200).json({ message: 'Cập nhật người thuê thành công', data: renter });
});

export const resendInvite = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = renterIdParamSchema.parse(req.params);
  const result = await renterService.resendInvite(context, id);
  res.status(200).json({ message: 'Gửi lại lời mời thành công', data: result });
});
