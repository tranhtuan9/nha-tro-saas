"use client";

import Link from "next/link";
import { getApiErrorMessage } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatBillingMonth, formatDate } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { ContractListItem, MeterReadingItem } from "@/lib/types";
import { useMemo } from "react";

export default function RenterMeterReadingsPage() {
  const contracts = usePagedList<ContractListItem>("/contracts", { pageSize: 50, status: "ACTIVE" });
  const roomId = contracts.rows[0]?.roomId ?? null;

  const meterReadings = usePagedList<MeterReadingItem>("/meter-readings", {
    pageSize: 20,
    roomId: roomId ?? undefined,
  });

  const latest = useMemo(() => {
    if (meterReadings.rows.length === 0) return null;
    const sorted = [...meterReadings.rows].sort((a, b) => b.billingMonth.localeCompare(a.billingMonth));
    return sorted[0];
  }, [meterReadings.rows]);

  const error = contracts.error ? getApiErrorMessage(contracts.error) : meterReadings.error ? getApiErrorMessage(meterReadings.error) : null;
  const isLoading = contracts.isLoading || meterReadings.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chỉ số điện nước"
        description="Xem chỉ số điện nước theo kỳ (kỳ gần nhất)."
        actions={
          <Link
            href="/renter/overview"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-container"
          >
            <Icon name="chevron_left" className="h-4 w-4" />
            Quay lại tổng quan
          </Link>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Chỉ số điện nước kỳ gần nhất</h2>
        </div>
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Đang tải…</p>
        ) : !latest ? (
          <p className="px-4 py-6 text-sm text-muted">Chưa có chỉ số điện nước nào.</p>
        ) : (
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted">Kỳ</p>
              <p className="font-medium text-ink">{formatBillingMonth(latest.billingMonth)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Chỉ số điện</p>
              <p className="text-sm text-ink">Chỉ số: {latest.electricityIndex}</p>
              <p className="text-sm text-ink">Tiêu thụ: {latest.electricityUsage}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Chỉ số nước</p>
              <p className="text-sm text-ink">Chỉ số: {latest.waterIndex}</p>
              <p className="text-sm text-ink">Tiêu thụ: {latest.waterUsage}</p>
            </div>
            <div className="flex items-start">
              <Badge tone={latest.anomaly ? "warning" : "success"} dot>
                {latest.anomaly ? "Có bất thường" : "Bình thường"}
              </Badge>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs text-muted">Ngày ghi</p>
              <p className="text-sm text-ink">{formatDate(latest.createdAt)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Lịch sử chỉ số</h2>
        </div>
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Đang tải…</p>
        ) : meterReadings.rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Chưa có dữ liệu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted">Kỳ</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted">Điện (chỉ số / tiêu thụ)</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted">Nước (chỉ số / tiêu thụ)</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted">Trạng thái</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted">Ngày ghi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...meterReadings.rows]
                  .sort((a, b) => b.billingMonth.localeCompare(a.billingMonth))
                  .map((mr) => (
                    <tr key={mr.id}>
                      <td className="px-4 py-2 text-ink">{formatBillingMonth(mr.billingMonth)}</td>
                      <td className="px-4 py-2 text-ink">{mr.electricityIndex} / {mr.electricityUsage}</td>
                      <td className="px-4 py-2 text-ink">{mr.waterIndex} / {mr.waterUsage}</td>
                      <td className="px-4 py-2">
                        <Badge tone={mr.anomaly ? "warning" : "success"} dot>
                          {mr.anomaly ? "Bất thường" : "Bình thường"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-ink">{formatDate(mr.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
