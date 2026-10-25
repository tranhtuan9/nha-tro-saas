"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { NotificationItem } from "@/lib/types";

const PREVIEW_SIZE = 6;

const READ_ALL_KEY = "notifications:unread-count";

const TYPE_TONE: Record<string, string> = {
  NEW_INVOICE: "bg-info-soft text-info-text",
  PAYMENT_SUCCESS: "bg-success-soft text-success-text",
  PAYMENT_AMOUNT_MISMATCH: "bg-danger-soft text-danger-text",
  PAYMENT_REFUND_REQUIRED: "bg-danger-soft text-danger-text",
  PAYMENT_RECONCILE: "bg-warning-soft text-warning-text",
};

const TYPE_ICON: Record<string, "receipt_long" | "success" | "alert" | "info"> = {
  NEW_INVOICE: "receipt_long",
  PAYMENT_SUCCESS: "success",
  PAYMENT_AMOUNT_MISMATCH: "alert",
  PAYMENT_REFUND_REQUIRED: "alert",
  PAYMENT_RECONCILE: "alert",
};

export function NotificationBell({ href }: { href: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = useSWR(READ_ALL_KEY, () => getUnreadCount(), {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });
  const list = useSWR(
    open ? ["notifications", "preview"] : null,
    () => getNotifications({ pageSize: PREVIEW_SIZE }),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const count = unread.data?.count ?? 0;
  const rows = list.data?.data ?? [];

  async function onOpenItem(item: NotificationItem) {
    if (item.isRead) return;
    try {
      await markNotificationRead(item.id);
      await Promise.all([unread.mutate(), list.mutate()]);
    } catch (err) {
      notifyApp({ tone: "error", message: getApiErrorMessage(err) });
    }
  }

  async function onReadAll() {
    try {
      await markAllNotificationsRead();
      await Promise.all([unread.mutate(), list.mutate()]);
    } catch (err) {
      notifyApp({ tone: "error", message: getApiErrorMessage(err) });
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={count > 0 ? `Thông báo (${count} chưa đọc)` : "Thông báo"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-container hover:text-ink"
      >
        <Icon name="notifications" className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 rounded-lg border border-border bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-ink">Thông báo</p>
            {count > 0 && (
              <button
                type="button"
                onClick={() => void onReadAll()}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {list.isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted">Đang tải…</p>
            ) : rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">Chưa có thông báo nào</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void onOpenItem(item)}
                      className={cn(
                        "flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-container",
                        !item.isRead && "bg-primary-soft/40",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          TYPE_TONE[item.type] ?? "bg-surface-container text-muted",
                        )}
                      >
                        <Icon name={TYPE_ICON[item.type] ?? "info"} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{item.title}</span>
                          {!item.isRead && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                          )}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs text-muted">
                          {item.content}
                        </span>
                        <span className="mt-1 block text-[11px] text-placeholder">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-3 py-2 text-center">
            <Link
              href={href}
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Xem tất cả thông báo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
