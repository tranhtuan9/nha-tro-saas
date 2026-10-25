import axios from "axios";
import { clearSession, getToken } from "./auth-storage";
import { ERROR_MESSAGES } from "./error-messages";
import type {
  AiChatReply,
  AiHistoryEntry,
  AiProposal,
  ApiEnvelope,
  CreateInvoiceInput,
  InvoiceDetail,
  InvoiceListItem,
  InvoicePreview,
  InvoiceSummary,
  MeterSheetResponse,
  NotificationItem,
  PageResult,
  PaymentLinkResult,
  PaymentListItem,
  ServiceItem,
  UnreadCount,
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface AppNotification {
  tone: "error" | "success" | "info";
  message: string;
}

export const APP_NOTIFY_EVENT = "app:notify";

export function notifyApp(notification: AppNotification): void {
  window.dispatchEvent(new CustomEvent<AppNotification>(APP_NOTIFY_EVENT, { detail: notification }));
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

const SESSION_ERROR_CODES = new Set(["ACCOUNT_LOCKED", "TENANT_SUSPENDED", "SUBSCRIPTION_EXPIRED"]);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const raw = getToken();
  if (raw) config.headers.Authorization = `Bearer ${raw}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError<ApiErrorBody>(error)) {
      const status = error.response?.status ?? 0;
      const body = error.response?.data;
      const code = body?.error?.code ?? (status === 0 ? "NETWORK_ERROR" : "UNKNOWN_ERROR");
      const message =
        body?.error?.message ??
        (status === 0
          ? "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại."
          : "Đã có lỗi xảy ra. Vui lòng thử lại.");

      if (status === 401 && getToken()) {
        clearSession();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.dispatchEvent(new Event("app:session-expired"));
        }
      }

      if (status === 403 && SESSION_ERROR_CODES.has(code)) {
        notifyApp({ tone: "error", message });
      }

      return Promise.reject(new ApiError(status, code, message, body?.error?.details));
    }
    return Promise.reject(error);
  },
);

/** Fetcher dùng chung cho SWR: GET và unwrap Envelope; lỗi đã được interceptor chuyển thành ApiError. */
export async function apiFetcher<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await api.get<ApiEnvelope<T>>(path);
  return res.data;
}

/** Thông báo lỗi tiếng Việt hiển thị trong biểu mẫu: ưu tiên bảng mã lỗi, sau đó message từ backend. */
export function getApiErrorMessage(error: unknown, fallback = "Đã có lỗi xảy ra. Vui lòng thử lại."): string {
  if (error instanceof ApiError) return ERROR_MESSAGES[error.code] ?? error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export interface InvoiceListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  billingMonth?: string;
  roomId?: string;
  propertyId?: string;
  contractId?: string;
  [key: string]: string | number | boolean | null | undefined;
}

function toQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) return "";
  const qs = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return `?${qs}`;
}

/** GET /api/invoices — danh sách hóa đơn (Landlord thấy toàn Tenant, Renter chỉ của mình nhờ RLS). */
export async function getInvoices(params: InvoiceListParams = {}): Promise<PageResult<InvoiceListItem>> {
  const res = await api.get<PageResult<InvoiceListItem>>(`/invoices${toQuery(params)}`);
  return res.data;
}

export async function getInvoiceSummary(month?: string): Promise<InvoiceSummary> {
  const res = await api.get<ApiEnvelope<InvoiceSummary>>(`/invoices/summary${toQuery({ month })}`);
  return res.data.data;
}

export async function getInvoice(id: string): Promise<InvoiceDetail> {
  const res = await api.get<ApiEnvelope<InvoiceDetail>>(`/invoices/${id}`);
  return res.data.data;
}

/** UC18: xem trước hóa đơn — validate và tính toán nhưng KHÔNG ghi dữ liệu. */
export async function previewInvoice(input: CreateInvoiceInput): Promise<InvoicePreview> {
  const res = await api.post<ApiEnvelope<InvoicePreview>>("/invoices/preview", input);
  return res.data.data;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDetail> {
  const res = await api.post<ApiEnvelope<InvoiceDetail>>("/invoices", input);
  return res.data.data;
}

export async function cancelInvoice(id: string): Promise<InvoiceListItem> {
  const res = await api.patch<ApiEnvelope<InvoiceListItem>>(`/invoices/${id}/cancel`);
  return res.data.data;
}

export async function getRooms(params: { page?: number; pageSize?: number; propertyId?: string; status?: string; search?: string } = {}): Promise<PageResult<import("./types").RoomListItem>> {
  const res = await api.get<PageResult<import("./types").RoomListItem>>(`/rooms${toQuery(params)}`);
  return res.data;
}

export async function getRoom(id: string): Promise<import("./types").RoomListItem> {
  const res = await api.get<ApiEnvelope<import("./types").RoomListItem>>(`/rooms/${id}`);
  return res.data.data;
}

export async function getContracts(params: { page?: number; pageSize?: number; roomId?: string; renterId?: string; propertyId?: string; status?: string } = {}): Promise<PageResult<import("./types").ContractListItem>> {
  const res = await api.get<PageResult<import("./types").ContractListItem>>(`/contracts${toQuery(params)}`);
  return res.data;
}

export async function getContract(id: string): Promise<import("./types").ContractDetail> {
  const res = await api.get<ApiEnvelope<import("./types").ContractDetail>>(`/contracts/${id}`);
  return res.data.data;
}

export async function getMeterReadings(params: { page?: number; pageSize?: number; roomId?: string; propertyId?: string; billingMonth?: string } = {}): Promise<PageResult<import("./types").MeterReadingItem>> {
  const res = await api.get<PageResult<import("./types").MeterReadingItem>>(`/meter-readings${toQuery(params)}`);
  return res.data;
}

export async function getAdminPlans(): Promise<import("./types").PlanInfo[]> {
  const res = await api.get<ApiEnvelope<import("./types").PlanInfo[]>>("/admin/plans");
  return res.data.data;
}

export async function getAdminTenant(id: string): Promise<import("./types").AdminTenant> {
  const res = await api.get<ApiEnvelope<import("./types").AdminTenant>>(`/admin/tenants/${id}`);
  return res.data.data;
}

export interface AdminTenantPlanInput {
  planId: string;
  extendDays?: number;
  subscriptionEnd?: string;
}

export async function updateAdminTenantPlan(id: string, input: AdminTenantPlanInput): Promise<import("./types").AdminTenant> {
  const res = await api.patch<ApiEnvelope<import("./types").AdminTenant>>(`/admin/tenants/${id}/plan`, input);
  return res.data.data;
}

export async function setAdminTenantStatus(id: string, action: "suspend" | "activate"): Promise<import("./types").AdminTenant> {
  const res = await api.patch<ApiEnvelope<import("./types").AdminTenant>>(`/admin/tenants/${id}/${action}`);
  return res.data.data;
}

export async function setAdminUserLock(id: string, action: "lock" | "unlock"): Promise<import("./types").AdminUser> {
  const res = await api.patch<ApiEnvelope<import("./types").AdminUser>>(`/admin/users/${id}/${action}`);
  return res.data.data;
}

/** UC31: tạo link thanh toán payOS cho hóa đơn (Renter). */
export async function createPayment(invoiceId: string): Promise<PaymentLinkResult> {
  const res = await api.post<ApiEnvelope<PaymentLinkResult>>("/payments", { invoiceId });
  return res.data.data;
}

export async function getPayment(id: string): Promise<PaymentListItem> {
  const res = await api.get<ApiEnvelope<PaymentListItem>>(`/payments/${id}`);
  return res.data.data;
}

/** Đồng bộ trạng thái từ payOS sau khi quay về; trạng thái cuối cùng do Webhook quyết định. */
export async function syncPayment(id: string): Promise<PaymentListItem> {
  const res = await api.post<ApiEnvelope<PaymentListItem>>(`/payments/${id}/sync`);
  return res.data.data;
}

export async function cancelPayment(id: string): Promise<PaymentListItem> {
  const res = await api.post<ApiEnvelope<PaymentListItem>>(`/payments/${id}/cancel`);
  return res.data.data;
}

export interface SupportRequestListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  renterId?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export async function getSupportRequests(params: SupportRequestListParams = {}): Promise<PageResult<import("./types").SupportRequestItem>> {
  const res = await api.get<PageResult<import("./types").SupportRequestItem>>(`/support-requests${toQuery(params)}`);
  return res.data;
}

export async function getSupportRequest(id: string): Promise<import("./types").SupportRequestItem> {
  const res = await api.get<ApiEnvelope<import("./types").SupportRequestItem>>(`/support-requests/${id}`);
  return res.data.data;
}

export async function createSupportRequest(input: import("./types").CreateSupportRequestInput): Promise<import("./types").SupportRequestItem> {
  const res = await api.post<ApiEnvelope<import("./types").SupportRequestItem>>("/support-requests", input);
  return res.data.data;
}

export async function respondSupportRequest(id: string, input: import("./types").RespondSupportRequestInput): Promise<import("./types").SupportRequestItem> {
  const res = await api.patch<ApiEnvelope<import("./types").SupportRequestItem>>(`/support-requests/${id}/respond`, input);
  return res.data.data;
}

export interface PaymentListParams {
  page?: number;
  pageSize?: number;
  invoiceId?: string;
  status?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/** UC32: lịch sử thanh toán (Renter chỉ thấy của mình nhờ RLS). */
export async function getPayments(params: PaymentListParams = {}): Promise<PageResult<PaymentListItem>> {
  const res = await api.get<PageResult<PaymentListItem>>(`/payments${toQuery(params)}`);
  return res.data;
}

export interface NotificationListParams {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}

/** Thông báo của CHÍNH người đang đăng nhập (cả Landlord lẫn Renter). */
export async function getNotifications(
  params: NotificationListParams = {},
): Promise<PageResult<NotificationItem>> {
  const res = await api.get<PageResult<NotificationItem>>(`/notifications${toQuery(params)}`);
  return res.data;
}

export async function getUnreadCount(): Promise<UnreadCount> {
  const res = await api.get<ApiEnvelope<UnreadCount>>("/notifications/unread-count");
  return res.data.data;
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const res = await api.patch<ApiEnvelope<NotificationItem>>(`/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllNotificationsRead(): Promise<UnreadCount> {
  const res = await api.patch<ApiEnvelope<UnreadCount>>("/notifications/read-all");
  return res.data.data;
}

/** UC21–23: trò chuyện với Trợ lý AI; trả câu trả lời và đề xuất (nếu có) chờ xác nhận. */
export async function aiChat(message: string, history: AiHistoryEntry[]): Promise<AiChatReply> {
  const res = await api.post<AiChatReply>("/ai/chat", { message, history });
  return res.data;
}

export async function getAiProposals(params: { status?: string; page?: number; pageSize?: number } = {}): Promise<
  PageResult<AiProposal>
> {
  const res = await api.get<PageResult<AiProposal>>(`/ai/proposals${toQuery(params)}`);
  return res.data;
}

export async function confirmProposal(id: string): Promise<AiProposal> {
  const res = await api.post<ApiEnvelope<AiProposal>>(`/ai/proposals/${id}/confirm`);
  return res.data.data;
}

export async function rejectProposal(id: string): Promise<AiProposal> {
  const res = await api.post<ApiEnvelope<AiProposal>>(`/ai/proposals/${id}/reject`);
  return res.data.data;
}

/** Danh mục dịch vụ đang hoạt động, dùng cho lập hóa đơn (chỉ chọn từ danh mục). */
export async function getActiveServices(propertyId?: string): Promise<ServiceItem[]> {
  const res = await api.get<PageResult<ServiceItem>>(
    `/services${toQuery({ pageSize: 100, isActive: "true", propertyId })}`,
  );
  return res.data.data;
}

/** Bảng chỉ số điện nước đã ghi nhận của một nhà trọ trong kỳ (chỉ đọc, dùng khi lập hóa đơn). */
export async function getMeterSheet(propertyId: string, billingMonth: string): Promise<MeterSheetResponse> {
  const res = await api.get<MeterSheetResponse>(
    `/meter-readings/sheet${toQuery({ propertyId, billingMonth })}`,
  );
  return res.data;
}
