import { Request, Response } from 'express';
import * as meterReadingService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import {
  meterReadingIdParamSchema,
  meterReadingListQuerySchema,
  meterSheetQuerySchema,
  createMeterReadingSchema,
  updateMeterReadingSchema,
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
  const query = meterReadingListQuerySchema.parse(req.query);
  const result = await meterReadingService.listMeterReadings(context, query);
  res.status(200).json(result);
});

export const sheet = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const query = meterSheetQuerySchema.parse(req.query);
  const result = await meterReadingService.getMeterSheet(context, query);
  res.status(200).json(result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = createMeterReadingSchema.parse(req.body);
  const reading = await meterReadingService.createMeterReading(context, input);
  res.status(201).json({ message: 'Ghi chỉ số điện nước thành công', data: reading });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = meterReadingIdParamSchema.parse(req.params);
  const reading = await meterReadingService.getMeterReading(context, id);
  res.status(200).json({ data: reading });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = meterReadingIdParamSchema.parse(req.params);
  const input = updateMeterReadingSchema.parse(req.body);
  const reading = await meterReadingService.updateMeterReading(context, id, input);
  res.status(200).json({ message: 'Cập nhật chỉ số điện nước thành công', data: reading });
});
