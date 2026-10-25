import { cn } from "@/lib/cn";

export type BadgeTone = "success" | "danger" | "warning" | "info" | "primary" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success-text",
  danger: "bg-danger-soft text-danger-text",
  warning: "bg-warning-soft text-warning-text",
  info: "bg-info-soft text-info-text",
  primary: "bg-primary-soft text-primary",
  neutral: "bg-surface-container text-muted",
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
