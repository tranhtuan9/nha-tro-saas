"use client";

import { useMemo } from "react";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatBillingMonth, formatCurrency, formatDate } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { InvoiceListItem, SupportRequestItem } from "@/lib/types";

function getMonthOffset(months: number) {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function LandlordOverviewPage() {
  const invoices = usePagedList<InvoiceListItem>("/invoices", { pageSize: 50 });
  const support = usePagedList<SupportRequestItem>("/support-requests", { pageSize: 50 });

  const month = getMonthOffset(0);

  const outstanding = useMemo(
    () => invoices.rows.filter((invoice) => invoice.status === "UNPAID" || invoice.status === "OVERDUE").slice(0, 5),
    [invoices.rows],
  );
  const openSupport = useMemo(
    () => support.rows.filter((item) => item.status === "OPEN"),
    [support.rows],
  );

  const loadError = invoices.error
    ? getApiErrorMessage(invoices.error)
    : support.error
      ? getApiErrorMessage(support.error)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan" description="Theo dõi nhanh phòng, hóa đơn và phản ánh." />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Hóa đơn chưa thanh toán"
          value={invoices.isLoading ? "..." : outstanding.length}
          tone={outstanding.length > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Tổng hóa đơn"
          value={invoices.isLoading ? "..." : invoices.pagination?.total ?? invoices.rows.length}
        />
        <KpiCard
          label="Phản ánh mới"
          value={support.isLoading ? "..." : openSupport.length}
          tone={openSupport.length > 0 ? "warning" : "success"}
        />
        <KpiCard label="Kỳ hiện tại" value={formatBillingMonth(`${month}-01`)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Hóa đơn chưa thanh toán gần nhất</h2>
            <Link href="/landlord/invoices" className="text-xs font-semibold text-primary hover:underline">
              Xem tất cả
            </Link>
          </div>
          {invoices.isLoading ? (
            <p className="px-4 py-6 text-sm text-muted">Đang tải...</p>
          ) : outstanding.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Không có hóa đơn chưa thanh toán.</p>
          ) : (
            <ul className="divide-y divide-border">
              {outstanding.map((invoice) => (
                <li key={invoice.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-ink">
                      Phòng {invoice.room.roomCode} - Kỳ {formatBillingMonth(invoice.billingMonth)}
                    </p>
                    <p className="text-xs text-muted">Hạn {formatDate(invoice.dueDate)}</p>
                  </div>
                  <span className="font-semibold text-ink">{formatCurrency(invoice.totalAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Phản ánh mới</h2>
            <Link href="/landlord/feedback" className="text-xs font-semibold text-primary hover:underline">
              Xem tất cả
            </Link>
          </div>
          {support.isLoading ? (
            <p className="px-4 py-6 text-sm text-muted">Đang tải...</p>
          ) : openSupport.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Không có phản ánh mới.</p>
          ) : (
            <ul className="divide-y divide-border">
              {openSupport.slice(0, 5).map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="text-xs text-muted">{item.renter?.fullName ?? "-"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
