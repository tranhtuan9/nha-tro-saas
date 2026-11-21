"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatBillingMonth } from "@/lib/format";
import { Icon } from "@/components/icons";

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  allowClear?: boolean;
  prefix?: string;
  id?: string;
}

const VI_MONTHS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

export function MonthPicker({
  value,
  onChange,
  className,
  placeholder = "Chọn kỳ",
  allowClear = false,
  prefix = "Tháng ",
  id,
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentIso = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  const selectedYear = value ? Number(value.slice(0, 4)) : currentYear;
  const selectedMonth = value ? Number(value.slice(5, 7)) : null;
  const [viewYear, setViewYear] = useState<number>(selectedYear || currentYear);

  useEffect(() => {
    if (value) {
      const y = Number(value.slice(0, 4));
      if (y && !Number.isNaN(y)) setViewYear(y);
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayLabel = value ? `${prefix}${formatBillingMonth(value)}` : placeholder;

  const handleSelectMonth = (mIndex: number) => {
    const monthStr = String(mIndex + 1).padStart(2, "0");
    onChange(`${viewYear}-${monthStr}`);
    setIsOpen(false);
  };

  const handleSelectThisMonth = () => {
    onChange(currentIso);
    setViewYear(currentYear);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        id={id}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "relative flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-surface px-3 text-sm text-ink transition-colors hover:border-slate-400 select-none",
          isOpen && "border-primary ring-2 ring-primary/25",
          className
        )}
      >
        <span className={cn("truncate font-medium", value ? "text-ink" : "text-muted")}>
          {displayLabel}
        </span>

        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {allowClear && Boolean(value) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
              title="Xóa chọn kỳ (Xem tất cả)"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          )}
          <svg
            className={cn("h-4 w-4 transition-colors", isOpen ? "text-primary" : "text-slate-400")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-surface p-3 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewYear((y) => y - 1);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-base text-slate-500 hover:bg-surface-container hover:text-ink transition-colors"
              title="Năm trước"
            >
              ‹
            </button>
            <span className="font-semibold text-sm text-ink">{viewYear}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewYear((y) => y + 1);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-base text-slate-500 hover:bg-surface-container hover:text-ink transition-colors"
              title="Năm sau"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 py-2.5">
            {VI_MONTHS.map((mName, idx) => {
              const mNum = idx + 1;
              const isSelected = selectedYear === viewYear && selectedMonth === mNum;
              const isCurrent = currentYear === viewYear && currentMonth === mNum;

              return (
                <button
                  key={mName}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectMonth(idx);
                  }}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                    isSelected
                      ? "bg-primary text-white font-semibold shadow-sm"
                      : isCurrent
                        ? "border border-primary text-primary hover:bg-primary-soft"
                        : "text-slate-700 hover:bg-surface-container hover:text-ink"
                  )}
                >
                  {mName}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
            {allowClear ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-500 hover:text-danger-text font-medium transition-colors"
              >
                Xóa chọn
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectThisMonth();
              }}
              className="text-primary hover:underline font-semibold transition-colors"
            >
              Tháng này
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
