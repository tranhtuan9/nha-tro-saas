"use client";

import { useEffect, useState } from "react";
import { APP_NOTIFY_EVENT, type AppNotification } from "@/lib/api";
import { cn } from "@/lib/cn";

const TONE_CLASSES: Record<AppNotification["tone"], string> = {
  error: "bg-danger-soft text-danger-text ring-red-200",
  success: "bg-success-soft text-success-text ring-green-200",
  info: "bg-info-soft text-info-text ring-sky-200",
};

const VISIBLE_MS = 6000;

export function GlobalNotify() {
  const [items, setItems] = useState<Array<{ id: number; notification: AppNotification }>>([]);

  useEffect(() => {
    let nextId = 0;
    function onNotify(event: Event) {
      const notification = (event as CustomEvent<AppNotification>).detail;
      const id = ++nextId;
      setItems((current) => [...current, { id, notification }]);
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, VISIBLE_MS);
    }
    window.addEventListener(APP_NOTIFY_EVENT, onNotify);
    return () => window.removeEventListener(APP_NOTIFY_EVENT, onNotify);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {items.map(({ id, notification }) => (
        <div
          key={id}
          role="alert"
          className={cn(
            "pointer-events-auto rounded-lg px-4 py-3 text-sm font-medium shadow-dropdown ring-1 ring-inset",
            TONE_CLASSES[notification.tone],
          )}
        >
          {notification.message}
        </div>
      ))}
    </div>
  );
}
