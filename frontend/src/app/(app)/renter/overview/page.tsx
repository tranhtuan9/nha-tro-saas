"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createPayment, getApiErrorMessage, notifyApp } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  currentBillingMonth,
  formatBillingMonth,
  formatCurrency,
  formatDate,
} from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type {
  ContractListItem,
  InvoiceListItem,
  MeterReadingItem,
} from "@/lib/types";

export default function RenterOverviewPage() {
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invoices = usePagedList<InvoiceListItem>("/invoices", { pageSize: 100 });
  const contracts = usePagedList<ContractListItem>("/contracts", { pageSize: 10 });

  const activeContract = useMemo(
    () => contracts.rows.find((c) => c.status === "ACTIVE") ?? contracts.rows[0] ?? null,
    [contracts.rows],
  );
  const roomId = activeContract?.roomId ?? null;

  const meterReadings = usePagedList<MeterReadingItem>("/meter-readings", {
    pageSize: 5,
    roomId: roomId ?? undefined,
  });

  const latestMeter = useMemo(() => {
    if (meterReadings.rows.length === 0) return null;
    return [...meterReadings.rows].sort((a, b) =>
      b.billingMonth.localeCompare(a.billingMonth),
    )[0];
  }, [meterReadings.rows]);

  const currentInvoice = useMemo(
    () => invoices.rows.find((inv) => inv.billingMonth === currentBillingMonth()),
    [invoices.rows],
  );
  const outstandingInvoice = useMemo(
    () =>
      invoices.rows.find(
        (inv) => inv.status === "UNPAID" || inv.status === "OVERDUE",
      ) ?? null,
    [invoices.rows],
  );
  const invoiceToPay = currentInvoice?.status !== "PAID" && currentInvoice?.status !== "CANCELLED"
    ? currentInvoice
    : outstandingInvoice;

  const loadError =
    invoices.error
      ? getApiErrorMessage(invoices.error)
      : contracts.error
        ? getApiErrorMessage(contracts.error)
        : null;
  const visibleError = error ?? loadError;

  const room = activeContract?.room ?? invoices.rows[0]?.room ?? null;

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
        breadcrumb="Trang chủ / Tổng quan"
        title="Tổng quan"
      />

      {visibleError && <Alert tone="error">{visibleError}</Alert>}

      {/* Banner hóa đơn cần thanh toán */}
      {invoiceToPay && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">
            Bạn có{" "}
            <span className="font-semibold">1 hóa đơn cần thanh toán</span>
            {" "}· Kỳ {formatBillingMonth(invoiceToPay.billingMonth)} ·{" "}
            <span className="font-semibold">
              {formatCurrency(invoiceToPay.totalAmount)}
            </span>
          </p>
          <Button
            onClick={() => void pay(invoiceToPay)}
            loading={payingId === invoiceToPay.id}
          >
            Thanh toán
          </Button>
        </div>
      )}

      {/* 3 card thông tin */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Thông tin phòng */}
        <div className="flex flex-col rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Thông tin phòng</h2>
          </div>
          <div className="flex-1 space-y-2 px-4 py-4 text-sm">
            {contracts.isLoading ? (
              <p className="text-muted">Đang tải…</p>
            ) : !room ? (
              <p className="text-muted">Chưa có thông tin phòng.</p>
            ) : (
              <>
                <InfoRow label="Số phòng" value={room.roomCode} />
                {"propertyName" in room && room.propertyName ? (
                  <InfoRow label="Nhà trọ" value={room.propertyName} />
                ) : null}
                <InfoRow
                  label="Giá thuê"
                  value={
                    activeContract
                      ? formatCurrency(activeContract.monthlyRent)
                      : "—"
                  }
                />
              </>
            )}
          </div>
          <Link
            href="/renter/invoices"
            className="border-t border-border px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            Xem tất cả hóa đơn →
          </Link>
        </div>

        {/* Hợp đồng */}
        <div className="flex flex-col rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Hợp đồng</h2>
          </div>
          <div className="flex-1 space-y-2 px-4 py-4 text-sm">
            {contracts.isLoading ? (
              <p className="text-muted">Đang tải…</p>
            ) : !activeContract ? (
              <p className="text-muted">Chưa có hợp đồng.</p>
            ) : (
              <>
                <InfoRow
                  label="Thời hạn"
                  value={`${formatDate(activeContract.startDate)} – ${formatDate(activeContract.endDate)}`}
                />
                <InfoRow
                  label="Tiền đặt cọc"
                  value={formatCurrency(activeContract.deposit)}
                />
                <InfoRow
                  label="Trạng thái"
                  value={
                    activeContract.status === "ACTIVE"
                      ? "Đang hiệu lực"
                      : activeContract.status === "ENDED"
                        ? "Đã kết thúc"
                        : "Đã chấm dứt"
                  }
                />
              </>
            )}
          </div>
          <Link
            href="/renter/contract"
            className="border-t border-border px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            Chi tiết hợp đồng →
          </Link>
        </div>

        {/* Chỉ số điện nước kỳ gần nhất */}
        <div className="flex flex-col rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">
              Chỉ số điện nước kỳ gần nhất
            </h2>
          </div>
          <div className="flex-1 space-y-2 px-4 py-4 text-sm">
            {meterReadings.isLoading ? (
              <p className="text-muted">Đang tải…</p>
            ) : !latestMeter ? (
              <p className="text-muted">Chưa có dữ liệu.</p>
            ) : (
              <>
                <InfoRow
                  label="Điện tiêu thụ"
                  value={`${latestMeter.electricityIndex} → ${Number(latestMeter.electricityIndex) + Number(latestMeter.electricityUsage)} (${latestMeter.electricityUsage} kWh)`}
                />
                <InfoRow
                  label="Nước sinh hoạt"
                  value={`${latestMeter.waterIndex} → ${Number(latestMeter.waterIndex) + Number(latestMeter.waterUsage)} (${latestMeter.waterUsage} m³)`}
                />
              </>
            )}
          </div>
          <Link
            href="/renter/meter-readings"
            className="border-t border-border px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            Lịch sử điện nước →
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
