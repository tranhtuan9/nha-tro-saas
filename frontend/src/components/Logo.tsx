import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="currentColor" />
      <path d="M256 108 L404 226 L108 226 Z" fill="#FFFFFF" />
      <rect x="108" y="226" width="296" height="20" rx="10" fill="#FFFFFF" />
      <rect x="152" y="262" width="208" height="142" rx="16" fill="#FFFFFF" />
      <rect x="188" y="300" width="56" height="56" rx="10" fill="#2563EB" />
      <rect x="268" y="300" width="56" height="56" rx="10" fill="#2563EB" />
      <rect x="228" y="360" width="56" height="44" rx="8" fill="#BFD3FF" />
    </svg>
  );
}

export function Logo({
  className,
  subtitle = "SaaS",
  titleClassName,
  subtitleClassName,
}: {
  className?: string;
  subtitle?: string | null;
  titleClassName?: string;
  subtitleClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark className="h-9 w-9 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className={cn("truncate text-[15px] font-bold text-ink", titleClassName)}>Quản lý nhà trọ</p>
        {subtitle && (
          <p className={cn("text-[11px] font-medium uppercase tracking-wide text-muted", subtitleClassName)}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
