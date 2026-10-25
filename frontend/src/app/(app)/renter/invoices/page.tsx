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
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { formatBillingMonth, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { InvoiceDetail, InvoiceListItem, InvoiceStatus, PaymentListItem, PaymentStatus } from "@/lib/types";

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

interface InvoiceDetailModalProps {
  invoiceId: string | null;
  onClose: () => void;
  onPay: (id: string) => void;
  paying: boolean;
}

function InvoiceDetailModal({ invoiceId, onClose, onPay, paying }: InvoiceDetailModalProps) {
  const { data, isLoading } = useSWR(
    invoiceId ? ["/invoices", invoiceId] : null,
    () => apiFetcher<InvoiceDetail>(`/invoices/${invoiceId}`).then((res) => res.data),
    { revalidateOnFocus: false },
  );

  if (invoiceId === null) return null;

  const payable = data && data.status !== "PAID" && data.status !== "CANCELLED";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative my-auto w-full max-w-2xl rounded-xl border border-border bg-surface shadow-dropdown"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Chi tiết hóa đơn</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-container hover:text-ink"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">
          {isLoading || !data ? (
            <p className="text-sm text-muted">Đang tải chi tiết…</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">
                    Kỳ {formatBillingMonth(data.billingMonth)} · Phòng {data.room.roomCode}
                  </p>
                  <p className="text-xs text-muted">{data.room.propertyName}</p>
                </div>
                <Badge tone={STATUS_TONE[data.status]} dot>
                  {STATUS_LABEL[data.status]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                <p>Ngày lập: {formatDate(data.issueDate)}</p>
                <p>Hạn thanh toán: {formatDate(data.dueDate)}</p>
                {data.paidAt && <p>Đã trả: {formatDate(data.paidAt)}</p>}
              </div>

              <div className="rounded-lg border border-border">
                <div className="space-y-1.5 px-3 py-3">
                  <Row label="Tiền thuê phòng" value={data.rentAmount} />
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
                  {data.lineItems.length === 0 && <Row label="Dịch vụ" value={data.serviceAmount} />}
                  <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold text-ink">
                    <span>Tổng thanh toán kỳ {formatBillingMonth(data.billingMonth)}</span>
                    <span>{formatCurrency(data.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-border bg-canvas px-5 py-3.5">
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          {payable && (
            <Button onClick={() => void onPay(invoiceId)} loading={paying}>
              <Icon name="receipt_long" className="h-4 w-4" />
              Thanh toán qua payOS
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="whitespace-nowrap text-ink">{formatCurrency(value)}</span>
    </div>
  );
}

export default function RenterInvoicesPage() {
  const [tab, setTab] = useState("outstanding");
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PaymentListItem | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [paymentPage, setPaymentPage] = useState(1);

  const allInvoices = usePagedList<InvoiceListItem>("/invoices", { pageSize: 100 });
  const payments = usePagedList<PaymentListItem>("/payments", { page: paymentPage, pageSize: 20 });

  const outstanding = useMemo(
    () => allInvoices.rows.filter((invoice) => invoice.status === "UNPAID" || invoice.status === "OVERDUE"),
    [allInvoices.rows],
  );
  const paid = useMemo(
    () => allInvoices.rows.filter((invoice) => invoice.status === "PAID"),
    [allInvoices.rows],
  );

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

  const invoiceColumns: Column<InvoiceListItem>[] = [
    {
      key: "billingMonth",
      header: "Kỳ hóa đơn",
      cell: (invoice) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{formatBillingMonth(invoice.billingMonth)}</p>
          <p className="text-xs text-muted">
            {invoice.room.roomCode} · {invoice.room.propertyName}
          </p>
        </div>
      ),
    },
    {
      key: "total",
      header: "Tổng tiền",
      align: "right",
      cell: (invoice) => (
        <span className="whitespace-nowrap font-medium text-ink">
          {formatCurrency(invoice.totalAmount)}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Hạn thanh toán",
      align: "right",
      cell: (invoice) => (
        <div className="whitespace-nowrap text-right">
          <p>{formatDate(invoice.dueDate)}</p>
          {invoice.paidAt && <p className="text-xs text-muted">Đã trả {formatDate(invoice.paidAt)}</p>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (invoice) => (
        <Badge tone={STATUS_TONE[invoice.status]} dot>
          {STATUS_LABEL[invoice.status]}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      cell: (invoice) => (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setDetailId(invoice.id)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft"
          >
            Chi tiết
          </button>
          {(invoice.status === "UNPAID" || invoice.status === "OVERDUE") && (
            <Button onClick={() => void pay(invoice.id)} loading={payingId === invoice.id}>
              Thanh toán
            </Button>
          )}
        </div>
      ),
    },
  ];

  const paymentColumns: Column<PaymentListItem>[] = [
    {
      key: "orderCode",
      header: "Mã giao dịch",
      cell: (payment) => <span className="font-medium text-ink">{payment.orderCode}</span>,
    },
    {
      key: "createdAt",
      header: "Thời điểm",
      cell: (payment) => <span className="whitespace-nowrap">{formatDateTime(payment.createdAt)}</span>,
    },
    {
      key: "amount",
      header: "Số tiền",
      align: "right",
      cell: (payment) => (
        <span className="whitespace-nowrap font-medium text-ink">{formatCurrency(payment.amount)}</span>
      ),
    },
    {
      key: "method",
      header: "Phương thức",
      cell: () => <span className="text-muted">Cổng thanh toán payOS</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (payment) => (
        <Badge tone={PAYMENT_TONE[payment.status]} dot>
          {PAYMENT_LABEL[payment.status]}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      cell: (payment) =>
        payment.status === "PENDING" ? (
          <button
            type="button"
            onClick={() => {
              setCancelError(null);
              setCancelTarget(payment);
            }}
            className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-semibold text-danger-text transition-colors hover:bg-danger-soft"
          >
            Hủy giao dịch
          </button>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hóa đơn & thanh toán"
        description="Theo dõi và thanh toán tiền phòng, điện nước, phí dịch vụ hàng tháng qua cổng payOS."
      />

      {visibleError && <Alert tone="error">{visibleError}</Alert>}

      <Tabs
        items={[
          { id: "outstanding", label: `Chưa thanh toán (${outstanding.length})` },
          { id: "paid", label: `Đã thanh toán (${paid.length})` },
          { id: "history", label: "Lịch sử giao dịch" },
        ]}
        active={tab}
        onChange={(id) => {
          setTab(id);
          setPaymentPage(1);
        }}
      />

      {tab === "outstanding" && (
        <DataTable
          columns={invoiceColumns}
          rows={outstanding}
          rowKey={(invoice) => invoice.id}
          isLoading={allInvoices.isLoading}
          error={allInvoices.error}
          onRetry={() => void allInvoices.mutate()}
          emptyTitle="Không có hóa đơn chưa thanh toán"
          emptyDescription="Bạn đã thanh toán đầy đủ các hóa đơn hiện có."
          emptyIcon={<Icon name="success" className="h-5 w-5" />}
        />
      )}

      {tab === "paid" && (
        <DataTable
          columns={invoiceColumns}
          rows={paid}
          rowKey={(invoice) => invoice.id}
          isLoading={allInvoices.isLoading}
          error={allInvoices.error}
          onRetry={() => void allInvoices.mutate()}
          emptyTitle="Chưa có hóa đơn đã thanh toán"
          emptyDescription="Các hóa đơn đã thanh toán sẽ xuất hiện ở đây."
          emptyIcon={<Icon name="receipt_long" className="h-5 w-5" />}
        />
      )}

      {tab === "history" && (
        <DataTable
          columns={paymentColumns}
          rows={payments.rows}
          rowKey={(payment) => payment.id}
          isLoading={payments.isLoading}
          error={payments.error}
          onRetry={() => void payments.mutate()}
          pagination={payments.pagination}
          onPageChange={(page) => {
            setPaymentPage(page);
          }}
          emptyTitle="Chưa có giao dịch nào"
          emptyDescription="Lịch sử thanh toán của bạn sẽ xuất hiện ở đây."
          emptyIcon={<Icon name="receipt_long" className="h-5 w-5" />}
        />
      )}

      <InvoiceDetailModal
        invoiceId={detailId}
        onClose={() => setDetailId(null)}
        onPay={(id) => void pay(id)}
        paying={payingId === detailId}
      />

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
              Giao dịch <span className="font-semibold">{cancelTarget?.orderCode}</span> sẽ bị hủy. Bạn có
              thể tạo lại link thanh toán sau.
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
