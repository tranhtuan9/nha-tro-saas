import { Request, Response } from 'express';
import * as aiService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import { chatSchema, proposalIdParamSchema, proposalListQuerySchema } from './schema';

// tenantId/userId/role CHỈ lấy từ JWT đã xác thực (req.user), không lấy từ body/query/params.
function getContext(req: Request): TenantContext {
  const user = req.user;
  if (!user || !user.tenantId) {
    throw ApiError.forbidden('NO_TENANT', 'Tài khoản không thuộc Tenant hợp lệ');
  }
  return { tenantId: user.tenantId, userId: user.userId, role: user.role };
}

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = chatSchema.parse(req.body);
  const result = await aiService.chat(context, input);
  res.status(200).json(result);
});

export const listProposals = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const query = proposalListQuerySchema.parse(req.query);
  const result = await aiService.listProposals(context, query);
  res.status(200).json(result);
});

// KHÔNG đọc body khi xác nhận: chỉ dùng tham số đã lưu trong đề xuất.
export const confirmProposal = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = proposalIdParamSchema.parse(req.params);
  const data = await aiService.confirmProposal(context, id);
  res.status(200).json({
    message:
      data.status === 'EXECUTED'
        ? 'Đã thực hiện đề xuất thành công'
        : 'Đã xác nhận nhưng thao tác không thực hiện được',
    data,
  });
});

export const rejectProposal = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = proposalIdParamSchema.parse(req.params);
  const data = await aiService.rejectProposal(context, id);
  res.status(200).json({ message: 'Đã từ chối đề xuất', data });
});
