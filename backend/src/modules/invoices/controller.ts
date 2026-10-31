import { Request, Response } from 'express';
import * as invoiceService from './service';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { TenantContext } from '../../lib/db';
import {
  createInvoiceSchema,
  invoiceIdParamSchema,
  invoiceListQuerySchema,
  summaryQuerySchema,
} from './schema';

// tenantId/userId/role CHỈ lấy từ JWT đã xác thực (req.user), không lấy từ body/query/params.
function getContext(req: Request): TenantContext {
  const user = req.user;
  if (!user || !user.tenantId) {
    throw ApiError.forbidden('NO_TENANT', 'Tài khoản không thuộc Tenant hợp lệ');
  }
  return { tenantId: user.tenantId, userId: user.userId, role: user.role };
}

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = createInvoiceSchema.parse(req.body);
  const data = await invoiceService.previewInvoice(context, input);
  res.status(200).json({ data });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const input = createInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.createInvoice(context, input);
  res.status(201).json({ message: 'Lập hóa đơn thành công', data: invoice });
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = invoiceIdParamSchema.parse(req.params);
  const invoice = await invoiceService.cancelInvoice(context, id);
  res.status(200).json({ message: 'Hủy hóa đơn thành công', data: invoice });
});

export const summary = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const query = summaryQuerySchema.parse(req.query);
  const data = await invoiceService.getInvoiceSummary(context, query);
  res.status(200).json({ data });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const query = invoiceListQuerySchema.parse(req.query);
  const result = await invoiceService.listInvoices(context, query);
  res.status(200).json(result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const context = getContext(req);
  const { id } = invoiceIdParamSchema.parse(req.params);
  const invoice = await invoiceService.getInvoice(context, id);
  res.status(200).json({ data: invoice });
});
