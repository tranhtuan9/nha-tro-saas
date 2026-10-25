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

export default function RenterContractPage() {
  const contracts = usePagedList<ContractListItem>("/contracts", { pageSize: 50 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hợp đồng"
        description="Thông tin phòng, nhà trọ, thời hạn, tiền thuê, tiền cọc, trạng thái hợp đồng."
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

      {contracts.error ? <Alert tone="error">{getApiErrorMessage(contracts.error)}</Alert> : null}

      <div className="rounded-lg border border-border bg-surface shadow-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Danh sách hợp đồng</h2>
        </div>
        {contracts.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Đang tải…</p>
        ) : contracts.rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Chưa có hợp đồng nào.</p>
        ) : (
          <div className="divide-y divide-border">
            {contracts.rows.map((contract) => {
              const propertyName = contract.propertyName ?? contract.room?.propertyName ?? "—";
              const roomCode = contract.room?.roomCode ?? "—";
              return (
                <div key={contract.id} className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted">Nhà trọ / Phòng</p>
                    <p className="font-medium text-ink">{propertyName}</p>
                    <p className="text-sm text-ink">Phòng {roomCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Thời hạn</p>
                    <p className="text-sm text-ink">{formatDate(contract.startDate)} — {formatDate(contract.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Tiền thuê / Tiền cọc</p>
                    <p className="text-sm text-ink">Tiền thuê: {formatCurrency(contract.monthlyRent)}</p>
                    <p className="text-sm text-ink">Tiền cọc: {formatCurrency(contract.deposit)}</p>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted">Trạng thái</p>
                      <Badge tone={STATUS_TONE[contract.status]} dot>
                        {STATUS_LABEL[contract.status]}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
