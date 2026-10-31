"use client";

import { useMemo } from "react";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatBillingMonth, formatDate } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { ContractListItem, MeterReadingItem } from "@/lib/types";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export default function RenterMeterReadingsPage() {
  const contracts = usePagedList<ContractListItem>("/contracts", {
    pageSize: 50,
    status: "ACTIVE",
  });
  const roomId = contracts.rows[0]?.roomId ?? null;

  const meterReadings = usePagedList<MeterReadingItem>("/meter-readings", {
    pageSize: 24,
    roomId: roomId ?? undefined,
  });

  const sorted = useMemo(
    () =>
      [...meterReadings.rows].sort((a, b) =>
        b.billingMonth.localeCompare(a.billingMonth),
      ),
    [meterReadings.rows],
  );

  const latest = sorted[0] ?? null;

  const error =
    contracts.error
      ? getApiErrorMessage(contracts.error)
      : meterReadings.error
        ? getApiErrorMessage(meterReadings.error)
        : null;

  const isLoading = contracts.isLoading || meterReadings.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Trang chủ / Chỉ số điện nước"
        title="Chỉ số điện nước"
        description="Lịch sử chỉ số tiêu thụ điện và nước theo từng kỳ."
        actions={
          <Link
            href="/renter/overview"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-container"
          >
            <Icon name="chevron_left" className="h-4 w-4" />
            Tổng quan
          </Link>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Kỳ gần nhất */}
      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            Kỳ gần nhất
            {latest ? (
              <span className="ml-2 font-normal text-muted">
                – {formatBillingMonth(latest.billingMonth)}
              </span>
            ) : null}
          </h2>
        </div>

        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Đang tải…</p>
        ) : !latest ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            Chưa có dữ liệu chỉ số điện nước.
          </p>
        ) : (
          <div className="grid gap-0 divide-y divide-border px-4 sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
            {/* Điện */}
            <div className="py-1 sm:pr-6">
              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Điện
              </p>
              <InfoRow
                label="Chỉ số đầu kỳ"
                value={`${latest.electricityIndex} kWh`}
              />
              <InfoRow
                label="Chỉ số cuối kỳ"
                value={`${Number(latest.electricityIndex) + Number(latest.electricityUsage)} kWh`}
              />
              <InfoRow
                label="Tiêu thụ"
                value={`${latest.electricityUsage} kWh`}
              />
            </div>
            {/* Nước */}
            <div className="py-1 sm:pl-6">
              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Nước
              </p>
              <InfoRow
                label="Chỉ số đầu kỳ"
                value={`${latest.waterIndex} m³`}
              />
              <InfoRow
                label="Chỉ số cuối kỳ"
                value={`${Number(latest.waterIndex) + Number(latest.waterUsage)} m³`}
              />
              <InfoRow label="Tiêu thụ" value={`${latest.waterUsage} m³`} />
            </div>
          </div>
        )}

        {latest && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <p className="text-xs text-muted">
              Ngày ghi: {formatDate(latest.createdAt)}
            </p>
            <Badge tone={latest.anomaly ? "warning" : "success"} dot>
              {latest.anomaly ? "Có bất thường" : "Bình thường"}
            </Badge>
          </div>
        )}
      </div>

      {/* Lịch sử tất cả kỳ */}
      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Lịch sử chỉ số</h2>
        </div>
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Đang tải…</p>
        ) : sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Chưa có dữ liệu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">
                    Kỳ
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted">
                    Điện tiêu thụ
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted">
                    Nước tiêu thụ
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">
                    Trạng thái
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">
                    Ngày ghi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((mr) => (
                  <tr key={mr.id} className="hover:bg-surface-container">
                    <td className="px-4 py-3 font-medium text-ink">
                      {formatBillingMonth(mr.billingMonth)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink">
                      {mr.electricityIndex} → {Number(mr.electricityIndex) + Number(mr.electricityUsage)}{" "}
                      <span className="text-xs text-muted">({mr.electricityUsage} kWh)</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink">
                      {mr.waterIndex} → {Number(mr.waterIndex) + Number(mr.waterUsage)}{" "}
                      <span className="text-xs text-muted">({mr.waterUsage} m³)</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={mr.anomaly ? "warning" : "success"} dot>
                        {mr.anomaly ? "Bất thường" : "Bình thường"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatDate(mr.createdAt)}
                    </td>
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
