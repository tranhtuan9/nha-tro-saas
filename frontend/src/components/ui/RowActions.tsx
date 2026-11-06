"use client";

import { cn } from "@/lib/cn";

type ActionTone = "primary" | "danger" | "muted";

const TONE_CLASSES: Record<ActionTone, string> = {
  primary: "text-primary hover:bg-primary-soft",
  danger: "text-danger-text hover:bg-danger-soft",
  muted: "text-muted hover:bg-surface-container hover:text-ink",
};

export function RowActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-end gap-1", className)}>{children}</div>;
}

export function ActionButton({
  tone = "muted",
  icon,
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ActionTone; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
