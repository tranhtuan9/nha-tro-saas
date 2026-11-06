"use client";

import Link from "next/link";
import { getApiErrorMessage } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrency, formatDate } from "@/lib/format";
import { usePagedList } from "@/lib/use-paged-list";
import type { ContractListItem } from "@/lib/types";

const STATUS_LABEL: Record<ContractListItem["status"], string> = {
  ACTIVE: "Đang hiệu lực",
  ENDED: "Đã kết thúc",
  TERMINATED: "Đã chấm dứt",
};

const STATUS_TONE: Record<ContractListItem["status"], BadgeTone> = {
  ACTIVE: "success",
  ENDED: "neutral",
  TERMINATED: "danger",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export default function RenterContractPage() {
  const contracts = usePagedList<ContractListItem>("/contracts", { pageSize: 50 });

  const active = contracts.rows.find((c) => c.status === "ACTIVE") ?? null;
  const others = contracts.rows.filter((c) => c.status !== "ACTIVE");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Trang chủ / Hợp đồng thuê"
        title="Hợp đồng thuê"
        description="Thông tin hợp đồng, tiền cọc, thời hạn thuê phòng."
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

      {contracts.error ? (
        <Alert tone="error">{getApiErrorMessage(contracts.error)}</Alert>
      ) : null}

      {contracts.isLoading ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-8 shadow-card">
          <p className="text-center text-sm text-muted">Đang tải…</p>
        </div>
      ) : contracts.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-12 shadow-card">
          <p className="text-center text-sm text-muted">Chưa có hợp đồng nào.</p>
        </div>
      ) : (
        <>
          {/* Hợp đồng đang hiệu lực */}
          {active && (
            <div className="rounded-lg border border-border bg-surface shadow-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">Hợp đồng hiện tại</h2>
                <Badge tone={STATUS_TONE[active.status]} dot>
                  {STATUS_LABEL[active.status]}
                </Badge>
              </div>
              <div className="grid gap-0 divide-y divide-border px-4 sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
                {/* Cột trái: Phòng & thời hạn */}
                <div className="py-1 sm:pr-6">
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Thông tin phòng
                  </p>
                  <InfoRow
                    label="Nhà trọ"
                    value={
                      active.propertyName ??
                      active.room?.propertyName ??
                      "—"
                    }
                  />
                  <InfoRow
                    label="Số phòng"
                    value={active.room?.roomCode ?? "—"}
                  />
                  <InfoRow
                    label="Thời hạn"
                    value={`${formatDate(active.startDate)} – ${formatDate(active.endDate)}`}
                  />
                </div>
                {/* Cột phải: Tài chính */}
                <div className="py-1 sm:pl-6">
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Tài chính
                  </p>
                  <InfoRow
                    label="Tiền thuê hàng tháng"
                    value={formatCurrency(active.monthlyRent)}
                  />
                  <InfoRow
                    label="Tiền đặt cọc"
                    value={formatCurrency(active.deposit)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Hợp đồng cũ */}
          {others.length > 0 && (
            <div className="rounded-lg border border-border bg-surface shadow-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">
                  Hợp đồng trước đây
                </h2>
              </div>
              <div className="divide-y divide-border">
                {others.map((contract) => {
                  const propertyName =
                    contract.propertyName ?? contract.room?.propertyName ?? "—";
                  const roomCode = contract.room?.roomCode ?? "—";
                  return (
                    <div
                      key={contract.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {propertyName} – Phòng {roomCode}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(contract.startDate)} –{" "}
                          {formatDate(contract.endDate)} ·{" "}
                          {formatCurrency(contract.monthlyRent)}/tháng
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[contract.status]} dot>
                        {STATUS_LABEL[contract.status]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
