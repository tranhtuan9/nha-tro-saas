import { Request, Response } from 'express';
import * as roomService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import {
  roomIdParamSchema,
  roomListQuerySchema,
  createRoomSchema,
  updateRoomSchema,
  updateRoomStatusSchema,
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
  const query = roomListQuerySchema.parse(req.query);
  const result = await roomService.listRooms(context, query);
  res.status(200).json(result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = createRoomSchema.parse(req.body);
  const room = await roomService.createRoom(context, input);
  res.status(201).json({ message: 'Tạo phòng thành công', data: room });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = roomIdParamSchema.parse(req.params);
  const room = await roomService.getRoom(context, id);
  res.status(200).json({ data: room });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = roomIdParamSchema.parse(req.params);
  const input = updateRoomSchema.parse(req.body);
  const room = await roomService.updateRoom(context, id, input);
  res.status(200).json({ message: 'Cập nhật phòng thành công', data: room });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = roomIdParamSchema.parse(req.params);
  const input = updateRoomStatusSchema.parse(req.body);
  const room = await roomService.updateRoomStatus(context, id, input);
  res.status(200).json({ message: 'Cập nhật trạng thái phòng thành công', data: room });
});
