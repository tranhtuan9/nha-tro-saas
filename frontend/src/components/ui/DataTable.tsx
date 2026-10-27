"use client";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { PagePagination } from "@/lib/types";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
}

const ALIGN_CLASSES = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

function TableSkeleton({ columnCount, loadingRows }: { columnCount: number; loadingRows: number }) {
  return (
    <>
      {Array.from({ length: loadingRows }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-t border-border">
          {Array.from({ length: columnCount }, (_, cellIndex) => (
            <td key={cellIndex} className="px-4 py-3.5">
              <div
                className="h-4 animate-pulse rounded bg-surface-container"
                style={{ width: `${45 + ((rowIndex * 7 + cellIndex * 13) % 45)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function StateRow({
  columnCount,
  icon,
  title,
  description,
  action,
}: {
  columnCount: number;
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <tr className="border-t border-border">
      <td colSpan={columnCount} className="px-4 py-12 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface-container text-muted">
          {icon}
        </span>
        <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </td>
    </tr>
  );
}

function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: PagePagination;
  onPageChange?: (page: number) => void;
}) {
  const { page, pageSize, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const canChange = Boolean(onPageChange) && totalPages > 1;

  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <p>
        Hiển thị <span className="font-medium text-ink">{from}</span>–
        <span className="font-medium text-ink">{to}</span> trong số{" "}
        <span className="font-medium text-ink">{total}</span>
      </p>
      {canChange && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page <= 1}
            aria-label="Trang trước"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-container hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="chevron_left" className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-medium text-ink">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= totalPages}
            aria-label="Trang sau"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-container hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="chevron_right" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = "Chưa có dữ liệu",
  emptyDescription,
  emptyIcon,
  pagination,
  onPageChange,
  footer,
  loadingRows = 6,
  rowClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  pagination?: PagePagination | null;
  onPageChange?: (page: number) => void;
  footer?: React.ReactNode;
  loadingRows?: number;
  rowClassName?: (row: T) => string | undefined;
}) {
  const columnCount = columns.length;
  const showEmpty = !isLoading && !error && rows.length === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-container/70">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted",
                    ALIGN_CLASSES[column.align ?? "left"],
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton columnCount={columnCount} loadingRows={loadingRows} />}
            {!isLoading && !!error && (
              <StateRow
                columnCount={columnCount}
                icon={<Icon name="alert" className="h-5 w-5" />}
                title="Không tải được dữ liệu"
                description={error ? "Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." : undefined}
                action={
                  onRetry && (
                    <Button variant="secondary" onClick={onRetry}>
                      <Icon name="refresh" className="h-4 w-4" />
                      Thử lại
                    </Button>
                  )
                }
              />
            )}
            {showEmpty && (
              <StateRow
                columnCount={columnCount}
                icon={emptyIcon ?? <Icon name="search" className="h-5 w-5" />}
                title={emptyTitle}
                description={emptyDescription}
              />
            )}
            {!isLoading &&
              !error &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    "border-t border-border transition-colors hover:bg-surface-container/50",
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-4 py-3.5 align-middle text-ink",
                        ALIGN_CLASSES[column.align ?? "left"],
                        column.cellClassName,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {pagination && <Pagination pagination={pagination} onPageChange={onPageChange} />}
      {footer && <div className="border-t border-border px-4 py-3 text-sm text-muted">{footer}</div>}
    </div>
  );
}
