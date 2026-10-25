"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createPayment, getApiErrorMessage, notifyApp } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { currentBillingMonth, formatBillingMonth, formatCurrency, formatDate } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { InvoiceListItem, InvoiceStatus, PaymentListItem } from "@/lib/types";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  CANCELLED: "Đã hủy",
};

const STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  UNPAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

export default function RenterOverviewPage() {
  const { user } = useAuth();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invoices = usePagedList<InvoiceListItem>("/invoices", { pageSize: 100 });
  const payments = usePagedList<PaymentListItem>("/payments", { pageSize: 5 });

  const today = new Date();

  const outstanding = useMemo(
    () => invoices.rows.filter((invoice) => invoice.status === "UNPAID" || invoice.status === "OVERDUE"),
    [invoices.rows],
  );
  const loadError = invoices.error
    ? getApiErrorMessage(invoices.error)
    : payments.error
      ? getApiErrorMessage(payments.error)
      : null;
  const visibleError = error ?? loadError;

  const outstandingTotal = useMemo(
    () => outstanding.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0),
    [outstanding],
  );

  const currentInvoice = useMemo(
    () => invoices.rows.find((invoice) => invoice.billingMonth === currentBillingMonth()),
    [invoices.rows],
  );
  const room = currentInvoice?.room ?? invoices.rows[0]?.room ?? null;

  const nextDue = useMemo(() => {
    const pending = outstanding
      .map((invoice) => invoice.dueDate)
      .filter(Boolean)
      .sort();
    return pending[0] ?? null;
  }, [outstanding]);

  async function pay(invoice: InvoiceListItem) {
    setPayingId(invoice.id);
    setError(null);
    try {
      const result = await createPayment(invoice.id);
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(getApiErrorMessage(err));
      notifyApp({ tone: "error", message: getApiErrorMessage(err) });
      setPayingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Chào ${user?.fullName ?? "bạn"}`}
        description={
          room
            ? `${room.propertyName} — Phòng ${room.roomCode}`
            : "Theo dõi hóa đơn và thanh toán tiền phòng hàng tháng."
        }
        actions={
          <Link
            href="/renter/invoices"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-container"
          >
            <Icon name="receipt_long" className="h-4 w-4" />
            Hóa đơn & thanh toán
          </Link>
        }
      />

      {visibleError && <Alert tone="error">{visibleError}</Alert>}

      {currentInvoice && currentInvoice.status !== "PAID" && currentInvoice.status !== "CANCELLED" && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning-soft bg-warning-soft px-4 py-3 text-sm text-warning-text ring-1 ring-inset ring-amber-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                Hóa đơn kỳ {formatBillingMonth(currentInvoice.billingMonth)} chưa thanh toán
              </p>
              <p className="text-xs">
                Số tiền {formatCurrency(currentInvoice.totalAmount)} · Hạn {formatDate(currentInvoice.dueDate)}
              </p>
            </div>
          </div>
          <Button onClick={() => void pay(currentInvoice)} loading={payingId === currentInvoice.id}>
            <Icon name="receipt_long" className="h-4 w-4" />
            Thanh toán ngay
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Hóa đơn chưa thanh toán"
          value={invoices.isLoading ? "…" : outstanding.length}
          tone={outstanding.length > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Tổng còn phải trả"
          value={invoices.isLoading ? "…" : formatCurrency(outstandingTotal)}
          tone={outstandingTotal > 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Hạn gần nhất"
          value={nextDue ? formatDate(nextDue) : "—"}
          hint={nextDue && new Date(nextDue) < today ? "Đã quá hạn" : undefined}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/renter/contract" className="rounded-lg border border-border bg-surface shadow-card transition-colors hover:bg-surface-container">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold text-ink">Phòng và nhà trọ</p>
              <p className="text-xs text-muted">{room ? `${room.propertyName} — Phòng ${room.roomCode}` : "Thông tin phòng, nhà trọ"}</p>
            </div>
            <Icon name="chevron_right" className="h-4 w-4 text-muted" />
          </div>
          <div className="border-t border-border px-4 py-2 text-xs font-semibold text-primary">Xem chi tiết</div>
        </Link>
        <Link href="/renter/contract" className="rounded-lg border border-border bg-surface shadow-card transition-colors hover:bg-surface-container">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold text-ink">Hợp đồng</p>
              <p className="text-xs text-muted">Thời hạn, tiền thuê, tiền cọc, trạng thái</p>
            </div>
            <Icon name="chevron_right" className="h-4 w-4 text-muted" />
          </div>
          <div className="border-t border-border px-4 py-2 text-xs font-semibold text-primary">Xem chi tiết</div>
        </Link>
        <Link href="/renter/meter-readings" className="rounded-lg border border-border bg-surface shadow-card transition-colors hover:bg-surface-container">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold text-ink">Chỉ số điện nước kỳ gần nhất</p>
              <p className="text-xs text-muted">Xem chỉ số điện nước theo kỳ</p>
            </div>
            <Icon name="chevron_right" className="h-4 w-4 text-muted" />
          </div>
          <div className="border-t border-border px-4 py-2 text-xs font-semibold text-primary">Xem chi tiết</div>
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Hóa đơn cần thanh toán</h2>
          <Link
            href="/renter/invoices"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Xem tất cả
          </Link>
        </div>
        {invoices.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Đang tải…</p>
        ) : outstanding.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Bạn không có hóa đơn nào cần thanh toán.</p>
        ) : (
          <ul className="divide-y divide-border">
            {outstanding.slice(0, 5).map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    Kỳ {formatBillingMonth(invoice.billingMonth)}
                  </p>
                  <p className="text-xs text-muted">
                    Hạn {formatDate(invoice.dueDate)} · {invoice.room.roomCode}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-ink">{formatCurrency(invoice.totalAmount)}</span>
                  <Badge tone={STATUS_TONE[invoice.status]} dot>
                    {STATUS_LABEL[invoice.status]}
                  </Badge>
                  <Button
                    onClick={() => void pay(invoice)}
                    loading={payingId === invoice.id}
                    variant="secondary"
                  >
                    Thanh toán
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Thanh toán gần đây</h2>
          <Link
            href="/renter/invoices"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Lịch sử
          </Link>
        </div>
        {payments.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Đang tải…</p>
        ) : payments.rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Chưa có giao dịch thanh toán nào.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.rows.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-muted">
                    Mã giao dịch {payment.orderCode} · {formatDate(payment.createdAt)}
                  </p>
                </div>
                <Badge tone={payment.status === "PAID" ? "success" : payment.status === "PENDING" ? "warning" : "neutral"} dot>
                  {payment.status === "PAID"
                    ? "Thành công"
                    : payment.status === "PENDING"
                      ? "Đang chờ"
                      : payment.status === "FAILED"
                        ? "Thất bại"
                        : "Đã hủy"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
