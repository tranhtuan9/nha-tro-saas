import { z } from 'zod';
import type { FunctionDeclaration } from '@google/genai';
import { getTenantDb, TenantContext } from '../../lib/db';
import { ApiError } from '../../lib/ApiError';
import { getCurrentYearMonth } from '../../lib/timezone';
import { listRooms, previewRoomStatus } from '../rooms/service';
import { getUnpaidInvoices, getInvoiceSummary, previewInvoice } from '../invoices/service';
import { previewContract } from '../contracts/service';
import { listMeterReadings } from '../meter-readings/service';
import type { CreateInvoiceInput } from '../invoices/schema';
import type { CreateContractInput } from '../contracts/schema';
import type { UpdateRoomStatusInput } from '../rooms/schema';
import {
  resolveActiveContract,
  resolvePropertyId,
  resolveRenter,
  resolveRoom,
  resolveService,
} from './resolver';

/** Loại hành động ghi được phép tạo đề xuất (khớp action_type trong audit_logs). */
export type ProposalActionType = 'createInvoice' | 'createContract' | 'setRoomStatus';

export type ToolOutcome =
  | { type: 'result'; data: unknown }
  | { type: 'clarification'; message: string }
  | { type: 'error'; message: string }
  | {
      type: 'proposal';
      actionType: ProposalActionType;
      params: CreateInvoiceInput | CreateContractInput | { roomId: string; status: string };
      preview: unknown;
    };

const billingMonthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const dateOnlyRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Giới hạn kết quả gửi cho model: tránh nhồi ngữ cảnh và giảm bề mặt dữ liệu không tin cậy.
const MAX_ROWS = 50;
const MAX_STRING_CHARS = 500;

function capRows<T>(rows: T[]): T[] {
  return rows.slice(0, MAX_ROWS);
}

function truncate(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.length > MAX_STRING_CHARS ? `${value.slice(0, MAX_STRING_CHARS)}…` : value;
}

function currentYearMonth(): string {
  const { year, month } = getCurrentYearMonth();
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}

/* -------------------------------------------------------------------------- */
/* Tham số công cụ (Zod — kiểm tra TRƯỚC khi thực thi)                         */
/* -------------------------------------------------------------------------- */

const readPropertyName = z.string().trim().min(1).max(150);
const roomCode = z.string().trim().min(1).max(30);

const getVacantRoomsSchema = z
  .object({ propertyName: readPropertyName.optional() })
  .strict('Chỉ nhận propertyName');

const getUnpaidInvoicesSchema = z
  .object({ billingMonth: z.string().regex(billingMonthRegex, 'Kỳ phải có định dạng YYYY-MM').optional() })
  .strict('Chỉ nhận billingMonth');

const getMonthlyRevenueSchema = z
  .object({ month: z.string().regex(billingMonthRegex, 'Tháng phải có định dạng YYYY-MM').optional() })
  .strict('Chỉ nhận month');

const getMeterReadingsSchema = z
  .object({
    propertyName: readPropertyName.optional(),
    roomCode: roomCode.optional(),
    billingMonth: z.string().regex(billingMonthRegex, 'Kỳ phải có định dạng YYYY-MM').optional(),
  })
  .strict('Chỉ nhận propertyName, roomCode, billingMonth');

const createInvoiceToolSchema = z
  .object({
    roomCode,
    propertyName: readPropertyName.optional(),
    billingMonth: z.string().regex(billingMonthRegex, 'Kỳ phải có định dạng YYYY-MM'),
    serviceNames: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(150),
            quantity: z.coerce.number().positive().max(999999.99),
          })
          .strict('Mỗi dịch vụ chỉ gồm name và quantity')
      )
      .max(20)
      .optional()
      .default([]),
    dueDate: z.string().regex(dateOnlyRegex, 'Ngày đáo hạn phải có định dạng YYYY-MM-DD').optional(),
  })
  .strict('Chỉ nhận roomCode, propertyName, billingMonth, serviceNames, dueDate');

const createContractToolSchema = z
  .object({
    roomCode,
    propertyName: readPropertyName.optional(),
    renterPhone: z.string().trim().min(6).max(20).optional(),
    renterName: z.string().trim().min(1).max(150).optional(),
    startDate: z.string().regex(dateOnlyRegex, 'Ngày bắt đầu phải có định dạng YYYY-MM-DD'),
    endDate: z.string().regex(dateOnlyRegex, 'Ngày kết thúc phải có định dạng YYYY-MM-DD'),
    monthlyRent: z.coerce.number().min(0, 'Tiền thuê không được âm'),
    deposit: z.coerce.number().min(0, 'Tiền cọc không được âm').optional(),
    terms: z.string().trim().max(5000).optional(),
  })
  .strict('Chỉ nhận roomCode, propertyName, renterPhone, renterName, startDate, endDate, monthlyRent, deposit, terms')
  .refine((data) => Boolean(data.renterPhone || data.renterName), {
    message: 'Cần cung cấp renterPhone hoặc renterName',
    path: ['renterPhone'],
  });

const setRoomStatusToolSchema = z
  .object({
    roomCode,
    propertyName: readPropertyName.optional(),
    status: z.enum(['AVAILABLE', 'MAINTENANCE'], {
      errorMap: () => ({ message: 'Chỉ được đặt AVAILABLE hoặc MAINTENANCE' }),
    }),
  })
  .strict('Chỉ nhận roomCode, propertyName, status');

/* -------------------------------------------------------------------------- */
/* Định nghĩa công cụ (registry)                                              */
/* -------------------------------------------------------------------------- */

type ToolDefinition = {
  name: string;
  description: string;
  kind: 'read' | 'write';
  parametersJsonSchema: Record<string, unknown>;
  schema: z.ZodTypeAny;
  run: (args: any, context: TenantContext) => Promise<ToolOutcome>;
};

const toolDefinitions: ToolDefinition[] = [
  {
    name: 'getVacantRooms',
    description:
      'Liệt kê các phòng đang trống (AVAILABLE). Có thể lọc theo tên nhà trọ. Trả về mã phòng, diện tích, giá thuê.',
    kind: 'read',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        propertyName: { type: 'string', description: 'Tên nhà trọ (tùy chọn)' },
      },
      additionalProperties: false,
    },
    schema: getVacantRoomsSchema,
    run: async (args, context) => {
      const db = getTenantDb(context);
      let propertyId: string | undefined;
      if (args.propertyName) {
        const resolved = await resolvePropertyId(db, args.propertyName);
        if (!resolved.ok) return { type: 'clarification', message: resolved.message };
        propertyId = resolved.value;
      }
      const rooms = await listRooms(context, {
        page: 1,
        pageSize: 100,
        status: 'AVAILABLE',
        propertyId,
      });
      return {
        type: 'result',
        data: capRows(
          rooms.data.map((room) => ({
            roomCode: room.roomCode,
            areaM2: room.areaM2,
            basePrice: room.basePrice,
            status: room.status,
            description: truncate(room.description),
          }))
        ),
      };
    },
  },
  {
    name: 'getUnpaidInvoices',
    description:
      'Liệt kê hóa đơn chưa thanh toán (gồm cả quá hạn) của toàn bộ nhà trọ. Có thể lọc theo kỳ YYYY-MM.',
    kind: 'read',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        billingMonth: { type: 'string', description: 'Kỳ dạng YYYY-MM (tùy chọn)' },
      },
      additionalProperties: false,
    },
    schema: getUnpaidInvoicesSchema,
    run: async (args, context) => {
      const invoices = await getUnpaidInvoices(context, { billingMonth: args.billingMonth });
      return {
        type: 'result',
        data: capRows(
          invoices.map((invoice) => ({
            billingMonth: invoice.billingMonth,
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            dueDate: invoice.dueDate,
            issueDate: invoice.issueDate,
            room: { roomCode: invoice.room.roomCode, propertyName: invoice.room.propertyName },
            renter: { fullName: invoice.renter.fullName },
          }))
        ),
      };
    },
  },
  {
    name: 'getMonthlyRevenue',
    description: 'Thống kê doanh thu và số hóa đơn theo kỳ (mặc định kỳ hiện tại).',
    kind: 'read',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Tháng dạng YYYY-MM (tùy chọn, mặc định tháng hiện tại)' },
      },
      additionalProperties: false,
    },
    schema: getMonthlyRevenueSchema,
    run: async (args, context) => {
      const summary = await getInvoiceSummary(context, { month: args.month ?? currentYearMonth() });
      return { type: 'result', data: summary };
    },
  },
  {
    name: 'getMeterReadings',
    description:
      'Liệt kê chỉ số điện nước đã ghi. Lọc theo tên nhà trọ, mã phòng và/hoặc kỳ YYYY-MM.',
    kind: 'read',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        propertyName: { type: 'string', description: 'Tên nhà trọ (tùy chọn)' },
        roomCode: { type: 'string', description: 'Mã phòng (tùy chọn)' },
        billingMonth: { type: 'string', description: 'Kỳ dạng YYYY-MM (tùy chọn)' },
      },
      additionalProperties: false,
    },
    schema: getMeterReadingsSchema,
    run: async (args, context) => {
      const db = getTenantDb(context);
      let propertyId: string | undefined;
      let roomId: string | undefined;

      if (args.propertyName) {
        const resolved = await resolvePropertyId(db, args.propertyName);
        if (!resolved.ok) return { type: 'clarification', message: resolved.message };
        propertyId = resolved.value;
      }
      if (args.roomCode) {
        const resolved = await resolveRoom(db, args.roomCode, args.propertyName);
        if (!resolved.ok) return { type: 'clarification', message: resolved.message };
        roomId = resolved.value.id;
      }

      const readings = await listMeterReadings(context, {
        page: 1,
        pageSize: 100,
        roomId,
        propertyId,
        billingMonth: args.billingMonth,
      });
      return {
        type: 'result',
        data: capRows(
          readings.data.map((reading) => ({
            billingMonth: reading.billingMonth.slice(0, 7),
            room: {
              roomCode: reading.room.roomCode,
              propertyName: reading.room.propertyName,
            },
            electricityIndex: reading.electricityIndex,
            waterIndex: reading.waterIndex,
            electricityUsage: reading.electricityUsage,
            waterUsage: reading.waterUsage,
          }))
        ),
      };
    },
  },
  {
    name: 'createInvoice',
    description:
      'ĐỀ XUẤT lập hóa đơn cho một phòng. Hệ thống chỉ tạo đề xuất, người dùng phải xác nhận trên giao diện. Cần mã phòng, kỳ (YYYY-MM), danh sách dịch vụ (tên + số lượng) nếu có.',
    kind: 'write',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        roomCode: { type: 'string', description: 'Mã phòng' },
        propertyName: { type: 'string', description: 'Tên nhà trọ (nếu mã phòng trùng)' },
        billingMonth: { type: 'string', description: 'Kỳ dạng YYYY-MM' },
        serviceNames: {
          type: 'array',
          description: 'Dịch vụ chọn từ danh mục của nhà trọ (tùy chọn)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
            },
            required: ['name', 'quantity'],
            additionalProperties: false,
          },
        },
        dueDate: { type: 'string', description: 'Ngày đáo hạn dạng YYYY-MM-DD (tùy chọn)' },
      },
      required: ['roomCode', 'billingMonth'],
      additionalProperties: false,
    },
    schema: createInvoiceToolSchema,
    run: async (args, context) => {
      const db = getTenantDb(context);
      const resolvedRoom = await resolveRoom(db, args.roomCode, args.propertyName);
      if (!resolvedRoom.ok) return { type: 'clarification', message: resolvedRoom.message };

      const resolvedContract = await resolveActiveContract(db, resolvedRoom.value.id);
      if (!resolvedContract.ok) return { type: 'clarification', message: resolvedContract.message };

      const services: Array<{ serviceId: string; quantity: number }> = [];
      for (const item of args.serviceNames as Array<{ name: string; quantity: number }>) {
        const resolved = await resolveService(db, resolvedRoom.value.propertyId, item.name);
        if (!resolved.ok) return { type: 'clarification', message: resolved.message };
        services.push({ serviceId: resolved.value, quantity: item.quantity });
      }

      const input: CreateInvoiceInput = {
        contractId: resolvedContract.value,
        billingMonth: args.billingMonth,
        services,
        ...(args.dueDate ? { dueDate: args.dueDate } : {}),
      };
      const preview = await previewInvoice(context, input);
      return { type: 'proposal', actionType: 'createInvoice', params: input, preview };
    },
  },
  {
    name: 'createContract',
    description:
      'ĐỀ XUẤT tạo hợp đồng thuê cho một phòng. Hệ thống chỉ tạo đề xuất, người dùng phải xác nhận. Cần mã phòng, người thuê (SĐT hoặc họ tên), ngày bắt đầu/kết thúc, tiền thuê.',
    kind: 'write',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        roomCode: { type: 'string', description: 'Mã phòng' },
        propertyName: { type: 'string', description: 'Tên nhà trọ (nếu mã phòng trùng)' },
        renterPhone: { type: 'string', description: 'Số điện thoại người thuê' },
        renterName: { type: 'string', description: 'Họ tên người thuê (phụ trợ khi không có SĐT)' },
        startDate: { type: 'string', description: 'Ngày bắt đầu YYYY-MM-DD' },
        endDate: { type: 'string', description: 'Ngày kết thúc YYYY-MM-DD' },
        monthlyRent: { type: 'number', description: 'Tiền thuê mỗi tháng (VND)' },
        deposit: { type: 'number', description: 'Tiền cọc (VND, tùy chọn)' },
        terms: { type: 'string', description: 'Điều khoản (tùy chọn)' },
      },
      required: ['roomCode', 'startDate', 'endDate', 'monthlyRent'],
      additionalProperties: false,
    },
    schema: createContractToolSchema,
    run: async (args, context) => {
      const db = getTenantDb(context);
      const resolvedRoom = await resolveRoom(db, args.roomCode, args.propertyName);
      if (!resolvedRoom.ok) return { type: 'clarification', message: resolvedRoom.message };

      // Ưu tiên SĐT; chỉ khi không có SĐT mới phân giải theo họ tên.
      const resolvedRenter = await resolveRenter(db, {
        ...(args.renterPhone ? { renterPhone: args.renterPhone } : {}),
        ...(!args.renterPhone && args.renterName ? { renterName: args.renterName } : {}),
      });
      if (!resolvedRenter.ok) return { type: 'clarification', message: resolvedRenter.message };

      const input: CreateContractInput = {
        roomId: resolvedRoom.value.id,
        renterId: resolvedRenter.value,
        startDate: args.startDate,
        endDate: args.endDate,
        monthlyRent: args.monthlyRent,
        deposit: args.deposit ?? 0,
        ...(args.terms ? { terms: args.terms } : {}),
      };
      const preview = await previewContract(context, input);
      return { type: 'proposal', actionType: 'createContract', params: input, preview };
    },
  },
  {
    name: 'setRoomStatus',
    description:
      'ĐỀ XUẤT đổi trạng thái phòng sang AVAILABLE (trống) hoặc MAINTENANCE (bảo trì). Hệ thống chỉ tạo đề xuất, người dùng phải xác nhận.',
    kind: 'write',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        roomCode: { type: 'string', description: 'Mã phòng' },
        propertyName: { type: 'string', description: 'Tên nhà trọ (nếu mã phòng trùng)' },
        status: { type: 'string', enum: ['AVAILABLE', 'MAINTENANCE'], description: 'Trạng thái mới' },
      },
      required: ['roomCode', 'status'],
      additionalProperties: false,
    },
    schema: setRoomStatusToolSchema,
    run: async (args, context) => {
      const db = getTenantDb(context);
      const resolvedRoom = await resolveRoom(db, args.roomCode, args.propertyName);
      if (!resolvedRoom.ok) return { type: 'clarification', message: resolvedRoom.message };

      const params = { roomId: resolvedRoom.value.id, status: args.status as string };
      const preview = await previewRoomStatus(context, resolvedRoom.value.id, {
        status: args.status,
      } as UpdateRoomStatusInput);
      return { type: 'proposal', actionType: 'setRoomStatus', params, preview };
    },
  },
];

const toolByName = new Map(toolDefinitions.map((tool) => [tool.name, tool]));

/**
 * Khai báo hàm gửi cho Gemini — CHỈ từ danh sách trắng này, không bao giờ sinh động.
 */
export const TOOL_DECLARATIONS: FunctionDeclaration[] = toolDefinitions.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parametersJsonSchema: tool.parametersJsonSchema,
}));

export function isWriteTool(name: string): boolean {
  return toolByName.get(name)?.kind === 'write';
}

/**
 * Thực thi một lời gọi hàm của model. Mọi tham số do model sinh đều đi qua Zod strict;
 * tên hàm ngoài danh sách trắng bị từ chối. Delegate sang service nghiệp vụ (không tự viết luật).
 * Không nhận tenantId từ tham số — context (từ JWT) được truyền vào service.
 */
export async function executeTool(
  name: string,
  rawArgs: unknown,
  context: TenantContext,
  options: { allowWrite: boolean }
): Promise<ToolOutcome> {
  const tool = toolByName.get(name);
  if (!tool) {
    return { type: 'error', message: `Hàm "${name}" không nằm trong danh sách cho phép.` };
  }
  if (tool.kind === 'write' && !options.allowWrite) {
    return {
      type: 'error',
      message:
        'Mỗi lượt trò chuyện chỉ được tạo tối đa một đề xuất. Hãy để người dùng xác nhận đề xuất hiện có.',
    };
  }

  const parsed = tool.schema.safeParse(rawArgs);
  if (!parsed.success) {
    return { type: 'error', message: `Tham số không hợp lệ cho "${name}": ${formatIssues(parsed.error)}` };
  }

  try {
    return await tool.run(parsed.data, context);
  } catch (err) {
    if (err instanceof ApiError) {
      return { type: 'error', message: err.message };
    }
    throw err;
  }
}
