"use client";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { INPUT_BASE } from "@/components/ui/form";

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Icon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Tìm kiếm..."}
        aria-label={ariaLabel ?? placeholder ?? "Tìm kiếm"}
        className={cn(INPUT_BASE, "border-border pl-9 [&::-webkit-search-cancel-button]:cursor-pointer")}
      />
    </div>
  );
}
