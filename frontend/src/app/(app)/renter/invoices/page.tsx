"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  apiFetcher,
  cancelPayment,
  createPayment,
  getApiErrorMessage,
  notifyApp,
} from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  formatBillingMonth,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type {
  InvoiceDetail,
  InvoiceListItem,
  InvoiceStatus,
  PaymentListItem,
  PaymentStatus,
} from "@/lib/types";

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

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Đang chờ",
  PAID: "Thành công",
  CANCELLED: "Đã hủy",
  FAILED: "Thất bại",
};

const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "neutral",
  FAILED: "danger",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="whitespace-nowrap text-right font-medium text-ink">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

interface InvoiceDetailPanelProps {
  invoice: InvoiceListItem;
  onPay: (id: string) => void;
  paying: boolean;
}

function InvoiceDetailPanel({ invoice, onPay, paying }: InvoiceDetailPanelProps) {
  const { data, isLoading } = useSWR(
    ["invoiceDetail", invoice.id],
    () => apiFetcher<InvoiceDetail>(`/invoices/${invoice.id}`).then((res) => res.data),
    { revalidateOnFocus: false },
  );

  const payable =
    invoice.status === "UNPAID" || invoice.status === "OVERDUE";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Chi tiết hóa đơn kỳ {formatBillingMonth(invoice.billingMonth)}
        </h2>
        <Badge tone={STATUS_TONE[invoice.status]} dot>
          {STATUS_LABEL[invoice.status]}
        </Badge>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted">Đang tải chi tiết…</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          <Row label="Tiền phòng" value={data.rentAmount} />
          <Row
            label={`Tiền điện (${data.electricityUnitPrice} đ/kWh)`}
            value={data.electricityAmount}
          />
          <Row
            label={`Tiền nước (${data.waterUnitPrice} đ/m³)`}
            value={data.waterAmount}
          />
          {data.lineItems.map((item) => (
            <Row
              key={item.id}
              label={`${item.serviceName} (${item.quantity} ${item.unit})`}
              value={item.amount}
            />
          ))}
          {data.lineItems.length === 0 && data.serviceAmount !== "0" && (
            <Row label="Phí dịch vụ" value={data.serviceAmount} />
          )}
          <div className="flex justify-between border-t border-border pt-2 font-semibold text-ink">
            <span>Tổng cộng</span>
            <span>{formatCurrency(invoice.totalAmount)}</span>
          </div>
        </div>
      )}

      {payable && (
        <Button
          className="w-full"
          onClick={() => onPay(invoice.id)}
          loading={paying}
        >
          Thanh toán trực tuyến (payOS)
        </Button>
      )}

      {invoice.paidAt && (
        <p className="text-center text-xs text-muted">
          Đã thanh toán lúc {formatDateTime(invoice.paidAt)}
        </p>
      )}
    </div>
  );
}

export default function RenterInvoicesPage() {
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PaymentListItem | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const allInvoices = usePagedList<InvoiceListItem>("/invoices", { pageSize: 100 });
  const payments = usePagedList<PaymentListItem>("/payments", { pageSize: 20 });

  // Sắp xếp: mới nhất lên đầu
  const sortedInvoices = useMemo(
    () =>
      [...allInvoices.rows].sort((a, b) =>
        b.billingMonth.localeCompare(a.billingMonth),
      ),
    [allInvoices.rows],
  );

  // Tự động chọn hóa đơn đầu tiên khi load xong
  const selectedInvoice = useMemo(() => {
    if (selectedId) return sortedInvoices.find((inv) => inv.id === selectedId) ?? null;
    return sortedInvoices[0] ?? null;
  }, [selectedId, sortedInvoices]);

  const loadError = allInvoices.error ? getApiErrorMessage(allInvoices.error) : null;
  const visibleError = error ?? loadError;

  async function pay(invoiceId: string) {
    setPayingId(invoiceId);
    setError(null);
    try {
      const result = await createPayment(invoiceId);
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(getApiErrorMessage(err));
      notifyApp({ tone: "error", message: getApiErrorMessage(err) });
      setPayingId(null);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      await cancelPayment(cancelTarget.id);
      notifyApp({ tone: "success", message: "Đã hủy giao dịch thanh toán" });
      setCancelTarget(null);
      await payments.mutate();
    } catch (err) {
      setCancelError(getApiErrorMessage(err));
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Trang chủ / Hóa đơn & thanh toán"
        title="Hóa đơn và thanh toán"
      />

      {visibleError && <Alert tone="error">{visibleError}</Alert>}

      {/* Layout 2 cột: danh sách trái + chi tiết phải */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Cột trái: danh sách kỳ hóa đơn */}
        <div className="rounded-lg border border-border bg-surface shadow-card">
          {allInvoices.isLoading ? (
            <p className="px-4 py-6 text-sm text-muted">Đang tải…</p>
          ) : sortedInvoices.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Chưa có hóa đơn nào.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sortedInvoices.map((invoice) => {
                const isSelected = selectedInvoice?.id === invoice.id;
                return (
                  <li key={invoice.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(invoice.id)}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-container ${
                        isSelected ? "bg-primary-soft" : ""
                      }`}
                    >
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            isSelected ? "text-primary" : "text-ink"
                          }`}
                        >
                          Kỳ {formatBillingMonth(invoice.billingMonth)}
                        </p>
                        <p className="text-xs text-muted">
                          {formatCurrency(invoice.totalAmount)}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[invoice.status]}>
                        {STATUS_LABEL[invoice.status]}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Cột phải: chi tiết hóa đơn đang chọn */}
        <div className="rounded-lg border border-border bg-surface px-5 py-5 shadow-card">
          {!selectedInvoice ? (
            <p className="text-sm text-muted">Chọn một kỳ hóa đơn để xem chi tiết.</p>
          ) : (
            <InvoiceDetailPanel
              invoice={selectedInvoice}
              onPay={(id) => void pay(id)}
              paying={payingId === selectedInvoice.id}
            />
          )}
        </div>
      </div>

      {/* Lịch sử thanh toán */}
      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Lịch sử thanh toán</h2>
        </div>
        {payments.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Đang tải…</p>
        ) : payments.rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Chưa có giao dịch nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted">
                    Mã giao dịch
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted">
                    Ngày
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted">
                    Số tiền
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted">
                    Trạng thái
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.rows.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 font-medium text-ink">
                      {payment.orderCode}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatDate(payment.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-ink">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={PAYMENT_TONE[payment.status]} dot>
                        {PAYMENT_LABEL[payment.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {payment.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancelError(null);
                            setCancelTarget(payment);
                          }}
                          className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-semibold text-danger-text transition-colors hover:bg-danger-soft"
                        >
                          Hủy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Hủy giao dịch thanh toán"
        tone="danger"
        confirmLabel="Hủy giao dịch"
        loading={cancelBusy}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void confirmCancel()}
        message={
          <>
            <p>
              Giao dịch{" "}
              <span className="font-semibold">{cancelTarget?.orderCode}</span>{" "}
              sẽ bị hủy. Bạn có thể tạo lại link thanh toán sau.
            </p>
            {cancelError && (
              <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
                {cancelError}
              </p>
            )}
          </>
        }
      />
    </div>
  );
}
