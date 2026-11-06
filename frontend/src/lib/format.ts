export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(String(value).replace(/[,\s]/g, ""));
  if (!Number.isFinite(amount)) return "—";
  return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "—";
    return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);
  return value;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)} ${hh}:${mm}`;
}

export function formatPhone(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return value;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

function toLocalDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Luật 12: Tenant hết hạn khi subscriptionEnd < hôm nay (còn giá trị trong ngày hết hạn),
 * khớp middleware requireActiveSubscription của backend.
 */
export function isSubscriptionExpired(subscriptionEnd: string | null | undefined): boolean {
  if (!subscriptionEnd) return false;
  const end = subscriptionEnd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  return end < toLocalDateKey(new Date());
}

/** Kỳ hóa đơn "YYYY-MM" -> hiển thị "MM/YYYY". */
export function formatBillingMonth(billingMonth: string | null | undefined): string {
  if (!billingMonth) return "—";
  const match = billingMonth.match(/^(\d{4})-(\d{2})/);
  if (!match) return billingMonth;
  return `${match[2]}/${match[1]}`;
}

/** Kỳ hóa đơn "YYYY-MM" của tháng trước/tháng sau (dùng cho điều hướng kỳ). */
export function shiftBillingMonth(billingMonth: string, offset: number): string {
  const [year, month] = billingMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Kỳ hiện tại theo máy cục bộ, định dạng "YYYY-MM". */
export function currentBillingMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Ngày ISO ("YYYY-MM-DD..." hoặc Date) -> giá trị cho input[type="date"]. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDateInputValue(parsed);
}

/**
 * Số ngày từ hôm nay đến ngày kết thúc: dương = còn hạn, 0 = hết hạn trong hôm nay,
 * âm = đã quá hạn; trả null khi không đọc được ngày.
 */
export function daysUntilDate(value: string | Date | null | undefined): number | null {
  const text = toDateInputValue(value);
  if (!text) return null;
  const target = new Date(`${text}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - localToday.getTime()) / 86_400_000);
}
