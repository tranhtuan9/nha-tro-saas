/**
 * Múi giờ nghiệp vụ (mặc định Asia/Ho_Chi_Minh). Dùng để xác định tháng hiện tại
 * cho kỳ chỉ số điện nước (ranh giới tháng tính theo múi giờ này).
 */
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function getAppTimezone(): string {
  return process.env.APP_TIMEZONE || DEFAULT_TIMEZONE;
}

/**
 * Trả về { year, month } hiện tại theo múi giờ APP_TIMEZONE.
 * Dùng Intl (Node 22 có full ICU) để xử lý đúng cả khi máy chủ ở múi giờ khác.
 */
export function getCurrentYearMonth(now: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getAppTimezone(),
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  return { year, month };
}

/**
 * Trả về ngày 'YYYY-MM-DD' HIỆN TẠI theo múi giờ APP_TIMEZONE, dưới dạng Date (UTC midnight).
 * Dùng cho issue_date, so sánh quá hạn (OVERDUE) và mặc định dueDate của hóa đơn.
 */
export function getTodayDateOnly(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getAppTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return new Date(Date.UTC(year, month - 1, day));
}
