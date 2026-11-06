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
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-extrabold tabular-nums",
          tone === "success" && "text-success-text",
          tone === "warning" && "text-warning-text",
          tone === "danger" && "text-danger-text",
          tone === "default" && "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
