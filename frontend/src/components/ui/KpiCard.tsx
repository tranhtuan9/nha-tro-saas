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
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-bold",
          tone === "success" && "text-success-text",
          tone === "warning" && "text-warning-text",
          tone === "danger" && "text-danger-text",
          tone === "default" && "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
