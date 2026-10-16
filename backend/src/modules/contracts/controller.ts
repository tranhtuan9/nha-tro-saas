import { Request, Response } from 'express';
import * as contractService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import {
  contractIdParamSchema,
  contractListQuerySchema,
  createContractSchema,
  updateContractSchema,
  terminateContractSchema,
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
  const query = contractListQuerySchema.parse(req.query);
  const result = await contractService.listContracts(context, query);
  res.status(200).json(result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = createContractSchema.parse(req.body);
  const contract = await contractService.createContract(context, input);
  res.status(201).json({ message: 'Tạo hợp đồng thành công', data: contract });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = contractIdParamSchema.parse(req.params);
  const contract = await contractService.getContract(context, id);
  res.status(200).json({ data: contract });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = contractIdParamSchema.parse(req.params);
  const input = updateContractSchema.parse(req.body);
  const contract = await contractService.updateContract(context, id, input);
  res.status(200).json({ message: 'Cập nhật hợp đồng thành công', data: contract });
});

export const terminate = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = contractIdParamSchema.parse(req.params);
  const input = terminateContractSchema.parse(req.body ?? {});
  const contract = await contractService.terminateContract(context, id, input);
  res.status(200).json({ message: 'Chấm dứt hợp đồng thành công', data: contract });
});

export const end = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = contractIdParamSchema.parse(req.params);
  const contract = await contractService.endContract(context, id);
  res.status(200).json({ message: 'Kết thúc hợp đồng thành công', data: contract });
});
