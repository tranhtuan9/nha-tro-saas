import { Request, Response } from 'express';
import * as supportRequestService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import {
  createSupportRequestSchema,
  respondSupportRequestSchema,
  supportRequestIdParamSchema,
  supportRequestListQuerySchema,
} from './schema';

// tenantId/userId/role CHỈ lấy từ JWT đã xác thực (req.user), không lấy từ body/query/params.
function getContext(req: Request): TenantContext {
  const user = req.user;
  if (!user || !user.tenantId) {
    throw ApiError.forbidden('NO_TENANT', 'Tài khoản không thuộc Tenant hợp lệ');
  }
  return { tenantId: user.tenantId, userId: user.userId, role: user.role };
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = createSupportRequestSchema.parse(req.body);
  const supportRequest = await supportRequestService.createSupportRequest(context, input);
  res.status(201).json({ message: 'Gửi phản ánh thành công', data: supportRequest });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const query = supportRequestListQuerySchema.parse(req.query);
  const result = await supportRequestService.listSupportRequests(context, query);
  res.status(200).json(result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = supportRequestIdParamSchema.parse(req.params);
  const supportRequest = await supportRequestService.getSupportRequest(context, id);
  res.status(200).json({ data: supportRequest });
});

export const respond = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = supportRequestIdParamSchema.parse(req.params);
  const input = respondSupportRequestSchema.parse(req.body);
  const supportRequest = await supportRequestService.respondSupportRequest(context, id, input);
  res.status(200).json({ message: 'Đã cập nhật phản ánh', data: supportRequest });
});
