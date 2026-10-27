"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  getApiErrorMessage,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  notifyApp,
} from "@/lib/api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { NotificationItem } from "@/lib/types";

const PAGE_SIZE = 20;

const TYPE_META: Record<string, { label: string; tone: string; icon: "receipt_long" | "success" | "alert" | "info" }> = {
  NEW_INVOICE: { label: "Hóa đơn mới", tone: "bg-info-soft text-info-text", icon: "receipt_long" },
  PAYMENT_SUCCESS: { label: "Thanh toán", tone: "bg-success-soft text-success-text", icon: "success" },
  PAYMENT_AMOUNT_MISMATCH: {
    label: "Sai số tiền",
    tone: "bg-danger-soft text-danger-text",
    icon: "alert",
  },
  PAYMENT_REFUND_REQUIRED: {
    label: "Cần hoàn tiền",
    tone: "bg-danger-soft text-danger-text",
    icon: "alert",
  },
  PAYMENT_RECONCILE: {
    label: "Cần đối soát",
    tone: "bg-warning-soft text-warning-text",
    icon: "alert",
  },
};

function meta(type: string) {
  return TYPE_META[type] ?? { label: "Thông báo", tone: "bg-surface-container text-muted", icon: "info" as const };
}

export function NotificationsView() {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = { page, pageSize: PAGE_SIZE, ...(tab === "unread" ? { isRead: false } : {}) };
  const list = useSWR(["notifications", "page", tab, page], () => getNotifications(params), {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  const unread = useSWR("notifications:unread-count", () => getUnreadCount(), {
    revalidateOnFocus: true,
  });

  const rows = list.data?.data ?? [];
  const pagination = list.data?.pagination ?? null;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / PAGE_SIZE)) : 1;
  const unreadCount = unread.data?.count ?? 0;

  async function refresh() {
    await Promise.all([list.mutate(), unread.mutate()]);
  }

  async function onRead(item: NotificationItem) {
    if (item.isRead || readingId) return;
    setReadingId(item.id);
    setError(null);
    try {
      await markNotificationRead(item.id);
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setReadingId(null);
    }
  }

  async function onReadAll() {
    setBusy(true);
    setError(null);
    try {
      await markAllNotificationsRead();
      notifyApp({ tone: "success", message: "Đã đánh dấu tất cả thông báo đã đọc" });
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Hệ thống / Hộp thư Thông báo"
        title="Thông báo"
        description="Các cập nhật về hóa đơn, thanh toán và hoạt động liên quan đến bạn."
        actions={
          <Button
            variant="secondary"
            className="h-9 px-3.5 text-xs font-semibold"
            onClick={() => void onReadAll()}
            loading={busy}
            disabled={unreadCount === 0}
          >
            <Icon name="check" className="h-4 w-4" />
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      <Tabs
        items={[
          { id: "all", label: "Tất cả" },
          { id: "unread", label: `Chưa đọc (${unreadCount})` },
        ]}
        active={tab}
        onChange={(id) => {
          setTab(id as "all" | "unread");
          setPage(1);
        }}
      />

      <div className="rounded-xl border border-border bg-surface shadow-card">
        {list.isLoading ? (
          <ul className="divide-y divide-border">
            {[0, 1, 2, 3].map((row) => (
              <li key={row} className="flex gap-4 px-5 py-4">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface-container" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-surface-container" />
                  <div className="h-3 w-full max-w-md animate-pulse rounded bg-surface-container" />
                </div>
              </li>
            ))}
          </ul>
        ) : list.error ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted">Không thể tải thông báo.</p>
            <Button variant="secondary" className="mt-3" onClick={() => void list.mutate()}>
              <Icon name="refresh" className="h-4 w-4" />
              Thử lại
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-muted">
              <Icon name="notifications" className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-medium text-ink">
              {tab === "unread" ? "Không còn thông báo chưa đọc" : "Chưa có thông báo nào"}
            </p>
            <p className="mt-1 text-sm text-muted">
              Thông báo về hóa đơn và thanh toán sẽ xuất hiện ở đây.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((item) => {
              const m = meta(item.type);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void onRead(item)}
                    className={cn(
                      "flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-container/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                      !item.isRead && "bg-primary-soft/40",
                    )}
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", m.tone)}>
                      <Icon name={m.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{item.title}</span>
                        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-medium text-muted">
                          {m.label}
                        </span>
                        {!item.isRead && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-muted">{item.content}</span>
                      <span className="mt-1.5 block text-xs text-placeholder">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted">
              Trang {pagination.page}/{totalPages} · {pagination.total} thông báo
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={pagination.page <= 1}
                aria-label="Trang trước"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-container hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="chevron_left" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={pagination.page >= totalPages}
                aria-label="Trang sau"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-container hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="chevron_right" className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
