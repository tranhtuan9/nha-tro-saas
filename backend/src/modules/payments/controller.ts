import { Request, Response } from 'express';
import * as paymentService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import {
  createPaymentSchema,
  paymentIdParamSchema,
  paymentListQuerySchema,
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
  const { invoiceId } = createPaymentSchema.parse(req.body);
  const { payment, created } = await paymentService.createPaymentLink(context, invoiceId);
  res.status(created ? 201 : 200).json({
    message: created ? 'Tạo link thanh toán thành công' : 'Đã có giao dịch thanh toán đang chờ',
    data: paymentService.toLinkResultResponse(payment),
  });
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = paymentIdParamSchema.parse(req.params);
  const payment = await paymentService.cancelPayment(context, id);
  res.status(200).json({ message: 'Hủy giao dịch thanh toán thành công', data: payment });
});

export const sync = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = paymentIdParamSchema.parse(req.params);
  const payment = await paymentService.syncPayment(context, id);
  res.status(200).json({ message: 'Đồng bộ trạng thái thanh toán thành công', data: payment });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const query = paymentListQuerySchema.parse(req.query);
  const result = await paymentService.listPayments(context, query);
  res.status(200).json(result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = paymentIdParamSchema.parse(req.params);
  const payment = await paymentService.getPayment(context, id);
  res.status(200).json({ data: payment });
});
