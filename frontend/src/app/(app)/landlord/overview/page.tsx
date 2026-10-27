"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { getApiErrorMessage, getInvoiceSummary } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { currentBillingMonth, formatBillingMonth, formatCurrency, formatDate } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { InvoiceListItem, InvoiceSummary, RoomListItem, SupportRequestItem } from "@/lib/types";

export default function LandlordOverviewPage() {
  const invoices = usePagedList<InvoiceListItem>("/invoices", { pageSize: 50 });
  const support = usePagedList<SupportRequestItem>("/support-requests", { pageSize: 50 });
  const rooms = usePagedList<RoomListItem>("/rooms", { pageSize: 100 });

  const month = currentBillingMonth();
  const summary = useSWR<InvoiceSummary>(["invoice-summary", month], () => getInvoiceSummary(month), {
    revalidateOnFocus: false,
  });

  const totalRooms = rooms.pagination?.total ?? rooms.rows.length;
  const occupiedRooms = rooms.rows.filter((room) => room.status === "OCCUPIED").length;
  const availableRooms = rooms.rows.filter((room) => room.status === "AVAILABLE").length;
  const unpaidCount = summary.data?.outstandingCount ?? 0;

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
      : rooms.error
        ? getApiErrorMessage(rooms.error)
        : summary.error
          ? getApiErrorMessage(summary.error)
          : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Bảng điều khiển / Tổng quan"
        title="Tổng quan vận hành"
        description="Giám sát tình trạng phòng, dòng tiền thu hộ trong kỳ và xử lý yêu cầu phản ánh từ khách thuê."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/landlord/invoices">
              <Button variant="secondary" className="h-9 px-3.5 text-xs">
                Lập hóa đơn
              </Button>
            </Link>
            <Link href="/landlord/properties">
              <Button className="h-9 px-3.5 text-xs font-semibold">
                + Thêm phòng
              </Button>
            </Link>
          </div>
        }
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {/* 4 Thẻ KPI Bento chuẩn theo Design System */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Phòng đang thuê"
          value={rooms.isLoading ? "..." : `${occupiedRooms}/${totalRooms}`}
          tone="success"
          hint={totalRooms > 0 ? `Tỷ lệ lấp đầy: ${Math.round((occupiedRooms / totalRooms) * 100)}%` : "Chưa có phòng"}
        />
        <KpiCard
          label="Phòng trống sẵn sàng"
          value={rooms.isLoading ? "..." : availableRooms}
          hint="Có thể cho thuê ngay"
        />
        <KpiCard
          label="Doanh thu thực thu"
          value={summary.isLoading ? "..." : summary.data ? formatCurrency(summary.data.paidRevenue) : "0 đ"}
          tone="success"
          hint={`Kỳ ${formatBillingMonth(month)}`}
        />
        <KpiCard
          label="Hóa đơn chờ thu"
          value={summary.isLoading ? "..." : summary.data ? unpaidCount : "0"}
          tone={unpaidCount > 0 ? "warning" : "success"}
          hint={unpaidCount > 0 ? "Cần đôn đốc thanh toán" : "Đã hoàn thành thu tiền"}
        />
      </div>

      {/* Hai khối công việc chính: Hóa đơn chưa thanh toán & Phản ánh mới */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Khối 1: Hóa đơn chờ thu */}
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-slate-50/50 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-bold text-ink">Hóa đơn chờ thanh toán</h2>
                <p className="text-xs text-muted">5 hóa đơn gần nhất cần thu tiền</p>
              </div>
              <Link
                href="/landlord/invoices"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                Xem tất cả ({invoices.rows.filter(i => i.status === "UNPAID" || i.status === "OVERDUE").length})
                <Icon name="chevron_right" className="h-3.5 w-3.5" />
              </Link>
            </div>

            {invoices.isLoading ? (
              <ul className="divide-y divide-border">
                {[0, 1, 2].map((row) => (
                  <li key={row} className="flex items-center justify-between px-5 py-4">
                    <div className="space-y-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-surface-container" />
                      <div className="h-3 w-24 animate-pulse rounded bg-surface-container" />
                    </div>
                    <div className="h-4 w-20 animate-pulse rounded bg-surface-container" />
                  </li>
                ))}
              </ul>
            ) : outstanding.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success-text">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink">Đã thu đủ trong kỳ</p>
                <p className="mt-1 text-xs text-muted">Không có hóa đơn nào đang chờ người thuê thanh toán.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {outstanding.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/80"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-ink text-sm">
                          Phòng {invoice.room.roomCode} · Kỳ {formatBillingMonth(invoice.billingMonth)}
                        </p>
                        <Badge tone={invoice.status === "OVERDUE" ? "danger" : "warning"} dot>
                          {invoice.status === "OVERDUE" ? "Quá hạn" : "Chưa thanh toán"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        Khách: <span className="font-medium text-slate-700">{invoice.renter.fullName}</span> · Hạn nộp {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold tabular-nums text-slate-900 text-sm">
                        {formatCurrency(invoice.totalAmount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border bg-slate-50/30 px-5 py-3 text-right">
            <Link
              href="/landlord/invoices"
              className="text-xs font-medium text-primary hover:text-primary-hover"
            >
              Chuyển đến sổ hóa đơn & thu tiền →
            </Link>
          </div>
        </section>

        {/* Khối 2: Phản ánh mới */}
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-slate-50/50 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-bold text-ink">Phản ánh & Sự cố mới</h2>
                <p className="text-xs text-muted">Yêu cầu sửa chữa hoặc khiếu nại đang chờ xử lý</p>
              </div>
              <Link
                href="/landlord/feedback"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                Xem tất cả ({openSupport.length})
                <Icon name="chevron_right" className="h-3.5 w-3.5" />
              </Link>
            </div>

            {support.isLoading ? (
              <ul className="divide-y divide-border">
                {[0, 1, 2].map((row) => (
                  <li key={row} className="space-y-2 px-5 py-4">
                    <div className="h-4 w-48 animate-pulse rounded bg-surface-container" />
                    <div className="h-3 w-32 animate-pulse rounded bg-surface-container" />
                  </li>
                ))}
              </ul>
            ) : openSupport.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success-text">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink">Không có phản ánh mới</p>
                <p className="mt-1 text-xs text-muted">Mọi phản ánh của người thuê đều đã được giải quyết ổn thỏa.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {openSupport.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className="px-5 py-3.5 transition-colors hover:bg-slate-50/80 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-ink text-sm">{item.title}</p>
                        <Badge tone="warning" dot>
                          Mới
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {item.room ? `Phòng ${item.room.roomCode} · ` : ""}
                        Khách: <span className="font-medium text-slate-700">{item.renter?.fullName ?? "-"}</span>
                      </p>
                    </div>
                    <Link href="/landlord/feedback">
                      <Button variant="secondary" className="h-8 px-2.5 text-xs">
                        Xử lý
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border bg-slate-50/30 px-5 py-3 text-right">
            <Link
              href="/landlord/feedback"
              className="text-xs font-medium text-primary hover:text-primary-hover"
            >
              Xem toàn bộ danh sách phản ánh →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
