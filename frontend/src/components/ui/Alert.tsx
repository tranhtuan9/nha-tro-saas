import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

type AlertTone = "error" | "success" | "info" | "warning";

const TONE_CLASSES: Record<AlertTone, string> = {
  error: "bg-danger-soft text-danger-text ring-red-200",
  success: "bg-success-soft text-success-text ring-green-200",
  info: "bg-info-soft text-info-text ring-sky-200",
  warning: "bg-warning-soft text-warning-text ring-amber-200",
};

const TONE_ICON: Record<AlertTone, "alert" | "success" | "info"> = {
  error: "alert",
  success: "success",
  info: "info",
  warning: "alert",
};

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon name={TONE_ICON[tone]} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
