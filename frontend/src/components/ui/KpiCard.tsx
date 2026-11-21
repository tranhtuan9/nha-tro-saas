import { cn } from "@/lib/cn";

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const isLong = typeof value === "string" && value.length > 8;

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-5 sm:px-5 shadow-card">
      <p className="text-xs font-semibold uppercase text-muted truncate">{label}</p>
      <p
        className={cn(
          "mt-2 font-extrabold tabular-nums whitespace-nowrap tracking-tight",
          isLong ? "text-xl sm:text-2xl" : "text-3xl",
          tone === "success" && "text-success-text",
          tone === "warning" && "text-warning-text",
          tone === "danger" && "text-danger-text",
          tone === "default" && "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-muted truncate">{hint}</p>}
    </div>
  );
}
