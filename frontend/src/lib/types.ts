
export type SupportType = "COMPLAINT" | "REPAIR" | "OTHER";
export type SupportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export interface SupportRequestItem {
  id: string;
  tenantId: string;
  renterId: string;
  type: SupportType;
  title: string;
  content: string;
  status: SupportStatus;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  renter?: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
  };
  room?: {
    id: string;
    roomCode: string;
    propertyId: string;
  };
}
export interface CreateSupportRequestInput {
  type: SupportType;
  title: string;
  content: string;
}
export interface RespondSupportRequestInput {
  status: SupportStatus;
  response?: string;
}
export type Role = "ADMIN" | "LANDLORD" | "RENTER";

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  nationalId: string | null;
  role: Role;
  status: string;
  tenantId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PlanInfo {
  id: string;
  name: string;
  maxProperties: number;
  maxRooms: number;
  price?: string;
  durationDays?: number;
  isActive?: boolean;
}

export interface AdminTenant {
  id: string;
  name: string;
  status: string;
  planId: string | null;
  subscriptionEnd: string | null;
  plan?: PlanInfo | null;
  landlordCount?: number;
  roomCount?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  status: string;
  tenantId: string | null;
  createdAt: string;
}

/**
 * Login trß║ú to├án bß╗Ö row Tenant (bao gß╗ôm subscriptionEnd). Field `plan` l├á optional
 * theo contract n├óng cß║Ñp `GET /api/auth/me` (xem BAO_CAO_FE.txt) ΓÇö khi backend bß╗ò
 * sung, UI hiß╗çn giß╗¢i hß║ín g├│i x/y tß╗▒ ─æß╗Öng m├á kh├┤ng cß║ºn sß╗¡a code.
 */
export interface TenantSummary {
  id: string;
  name: string;
  planId?: string;
  status: string;
  subscriptionStart?: string | null;
  subscriptionEnd: string | null;
  plan?: PlanInfo | null;
}

export interface AuthResponse {
  token: string;
  user: User;
  tenant: TenantSummary | null;
}

export interface MePayload extends User {
  tenant?: TenantSummary | null;
}

export interface JwtClaims {
  userId: string;
  role: Role;
  tenantId: string | null;
}

export interface ApiEnvelope<T> {
  message?: string;
  data: T;
}

export interface PagePagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface PageResult<T> {
  data: T[];
  pagination: PagePagination;
}

export interface Property {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  description: string | null;
  electricityUnitPrice: string;
  waterUnitPrice: string;
  isActive: boolean;
  createdAt: string;
}

export type RoomStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";

export interface Room {
  id: string;
  tenantId: string;
  propertyId: string;
  roomCode: string;
  areaM2: string | null;
  basePrice: string;
  status: RoomStatus;
  description: string | null;
  createdAt: string;
}

export type RenterStatus = "ACTIVE" | "LOCKED";

/** Danh s├ích trß║ú nationalId ─æ├ú CHE mß╗Öt phß║ºn (vd 0790ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó78); GET /:id trß║ú ─æß║ºy ─æß╗º. */
export interface Renter {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  phone: string | null;
  nationalId: string | null;
  role: Role;
  status: RenterStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ContractStatus = "ACTIVE" | "ENDED" | "TERMINATED";

export interface Contract {
  id: string;
  tenantId: string;
  roomId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  terms: string | null;
  status: ContractStatus;
  terminatedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractDetail extends Contract {
  room: { id: string; roomCode: string; propertyId: string; property: { id: string; name: string } };
  renter: { id: string; fullName: string; email: string; phone: string | null };
}

export interface ServiceItem {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  unit: string;
  unitPrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeterReadingItem {
  id: string;
  roomId: string;
  room?: { id: string; roomCode: string; propertyId: string; propertyName?: string };
  billingMonth: string;
  electricityIndex: string;
  waterIndex: string;
  electricityUsage: string;
  waterUsage: string;
  anomaly: boolean;
  createdAt: string;
}

export interface RoomListItem {
  id: string;
  tenantId: string;
  propertyId: string;
  roomCode: string;
  areaM2: string | null;
  basePrice: string;
  status: RoomStatus;
  description: string | null;
  createdAt: string;
  propertyName?: string;
}

export interface ContractListItem {
  id: string;
  tenantId: string;
  roomId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  terms: string | null;
  status: ContractStatus;
  terminatedReason: string | null;
  createdAt: string;
  updatedAt: string;
  room?: { id: string; roomCode: string; propertyId: string; propertyName?: string };
  propertyName?: string;
}

/** Tß╗½ng d├▓ng cß╗ºa GET /api/meter-readings/sheet (backend trß║ú vß╗ü phß║│ng, kh├┤ng lß╗ông room). */
export interface MeterSheetRow {
  roomId: string;
  roomCode: string;
  renter: { id: string; fullName: string } | null;
  previous: { billingMonth: string; electricityIndex: string; waterIndex: string } | null;
  current: {
    id: string;
    billingMonth: string;
    electricityIndex: string;
    waterIndex: string;
    electricityUsage: string;
    waterUsage: string;
    createdAt: string;
  } | null;
  anomaly: boolean;
  locked: boolean;
}

/** Phß║ún hß╗ôi GET /api/meter-readings/sheet (kh├┤ng bß╗ìc ApiEnvelope). */
export interface MeterSheetResponse {
  propertyId: string;
  propertyName: string;
  billingMonth: string;
  data: MeterSheetRow[];
}

export type InvoiceStatus = "UNPAID" | "PAID" | "OVERDUE" | "CANCELLED";

/** D├▓ng h├│a ─æ╞ín (GET /api/invoices/:id): sao ch├⌐p t├¬n/─æ╞ín vß╗ï/─æ╞ín gi├í dß╗ïch vß╗Ñ tß║íi thß╗¥i ─æiß╗âm lß║¡p. */
export interface InvoiceLineItem {
  id: string;
  serviceId: string | null;
  serviceName: string;
  unit: string;
  unitPrice: string;
  quantity: string;
  amount: string;
}

/** Bß║ún ghi h├│a ─æ╞ín trong danh s├ích (GET /api/invoices) ΓÇö tiß╗ün trß║ú dß║íng string. */
export interface InvoiceListItem {
  id: string;
  tenantId: string;
  contractId: string;
  meterReadingId: string;
  billingMonth: string;
  electricityUnitPrice: string;
  waterUnitPrice: string;
  rentAmount: string;
  electricityAmount: string;
  waterAmount: string;
  serviceAmount: string;
  totalAmount: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  room: { id: string; roomCode: string; propertyId: string; propertyName: string };
  renter: { id: string; fullName: string };
}

export interface InvoiceDetail extends InvoiceListItem {
  lineItems: InvoiceLineItem[];
}

/** Kß║┐t quß║ú GET /api/invoices/summary: sß╗æ liß╗çu doanh thu theo kß╗│. */
export interface InvoiceSummary {
  month: string | null;
  issuedCount: number;
  issuedTotal: string;
  paidCount: number;
  paidTotal: string;
  paidRevenue: string;
  unpaidCount: number;
  unpaidTotal: string;
  overdueCount: number;
  overdueTotal: string;
  cancelledCount: number;
  outstandingCount: number;
  outstandingTotal: string;
}

/** Kß║┐t quß║ú POST /api/invoices/preview: h├│a ─æ╞ín tß║ím t├¡nh, ch╞░a ghi dß╗» liß╗çu. */
export interface InvoicePreview {
  contractId: string;
  meterReadingId: string;
  billingMonth: string;
  effectiveStatus: InvoiceStatus;
  electricityUnitPrice: string;
  waterUnitPrice: string;
  rentAmount: string;
  electricityAmount: string;
  waterAmount: string;
  serviceAmount: string;
  totalAmount: string;
  issueDate: string;
  dueDate: string;
  room: { id: string; roomCode: string; propertyId: string };
  renter: { id: string; fullName: string };
  lineItems: Omit<InvoiceLineItem, "id">[];
}

export interface CreateInvoiceInput {
  contractId: string;
  billingMonth: string;
  services: { serviceId: string; quantity: number }[];
  dueDate?: string;
}

export type PaymentStatus = "PENDING" | "PAID" | "CANCELLED" | "FAILED";

export interface PaymentListItem {
  id: string;
  invoiceId: string;
  orderCode: string;
  paymentLinkId: string | null;
  checkoutUrl: string | null;
  amount: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
}

/** Kß║┐t quß║ú POST /api/payments (201) hoß║╖c lß║Ñy lß║íi PENDING c├▓n hß║ín (200). */
export interface PaymentLinkResult {
  paymentId: string;
  invoiceId: string;
  orderCode: string;
  checkoutUrl: string;
  amount: string;
  status: PaymentStatus;
  expiresAt: string;
}

/** Th├┤ng b├ío hß╗ç thß╗æng (GET /api/notifications) ΓÇö NEW_INVOICE, PAYMENT_SUCCESS, PAYMENT_AMOUNT_MISMATCH... */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface UnreadCount {
  count: number;
}

export type AiHistoryRole = "user" | "assistant";

export interface AiHistoryEntry {
  role: AiHistoryRole;
  text: string;
}

export type AiProposalStatus = "PROPOSED" | "CONFIRMED" | "REJECTED" | "EXECUTED" | "FAILED";

/** ─Éß╗ü xuß║Ñt ghi dß╗» liß╗çu cß╗ºa Trß╗ú l├╜ AI (audit_logs nguß╗ôn AI) ΓÇö phß║úi chß╗¥ Landlord x├íc nhß║¡n. */
export interface AiProposal {
  id: string;
  actionType: string;
  params: unknown;
  preview: unknown;
  status: AiProposalStatus;
  createdAt: string;
  expiresAt: string;
}

/** Kß║┐t quß║ú POST /api/ai/chat: c├óu trß║ú lß╗¥i v├á ─æß╗ü xuß║Ñt k├¿m theo (nß║┐u c├│). */
export interface AiChatReply {
  reply: string;
  proposal: AiProposal | null;
}
