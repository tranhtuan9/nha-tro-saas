import type { ReactNode } from "react";
import type { IconName } from "@/lib/navigation";

const ICONS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  apartment: (
    <>
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <path d="M14 9h5a1 1 0 0 1 1 1v11" />
      <path d="M7 7h1.5M10.5 7H12M7 11h1.5M10.5 11H12M7 15h1.5M10.5 15H12" />
      <path d="M7 21v-3h4v3" />
    </>
  ),
  meeting_room: (
    <>
      <rect x="5" y="3" width="11" height="18" rx="1" />
      <circle cx="12.8" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  badge: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10.5" r="2" />
      <path d="M6 16.5c.7-1.4 1.8-2 3-2s2.3.6 3 2" />
      <path d="M15 10h4M15 13.5h3" />
    </>
  ),
  bolt: <path d="M13 2 4.5 13.5H11l-1 8.5 9.5-12.5H13z" />,
  receipt_long: (
    <>
      <path d="M5 3h14v18l-2.3-1.5L14.4 21 12 19.5 9.6 21 7.3 19.5 5 21z" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </>
  ),
  feedback: (
    <>
      <path d="M21 14.5a2 2 0 0 1-2 2H8.5L4.5 20.5V5a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2z" />
      <path d="M8 8.5h8M8 12h5" />
    </>
  ),
  smart_toy: (
    <>
      <rect x="5" y="8" width="14" height="10" rx="2" />
      <path d="M12 8V5.5" />
      <circle cx="12" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <path d="M9.5 15.5h5" />
      <path d="M5 11.5H3.5M5 14.5H3.5M19 11.5h1.5M19 14.5h1.5" />
    </>
  ),
  manage_accounts: (
    <>
      <circle cx="10" cy="8" r="3.2" />
      <path d="M4 20.5c1-3.2 3.2-5 6-5 1 0 1.9.2 2.7.7" />
      <circle cx="17.5" cy="16.5" r="2.5" />
      <path d="M17.5 12.8v-1.3M17.5 21.5v-1.3M21.2 16.5h1.3M12.5 16.5h1.3M20.1 13.9l.9-.9M14 20l.9-.9M20.1 19.1l.9.9M14 13l.9.9" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6" />
    </>
  ),
  domain: (
    <>
      <rect x="3" y="8" width="8" height="13" rx="1" />
      <rect x="13" y="3" width="8" height="18" rx="1" />
      <path d="M6 12h2M6 16h2M16 7h2M16 11h2M16 15h2M16 19h2" />
    </>
  ),
  logout: (
    <>
      <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </>
  ),
  chevron_down: <path d="M6 9.5 12 15.5 18 9.5" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eye_off: (
    <>
      <path d="M9.9 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.1-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7.5l9 6 9-6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 21.5 20.5h-19z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5 11 15.5 16.5 9.5" />
    </>
  ),
  construction: (
    <>
      <path d="M4 15.5h16" />
      <path d="M6 15.5v-2.5a6 6 0 0 1 12 0v2.5" />
      <path d="M10 15.5V13h4v2.5" />
    </>
  ),
  chevron_left: <path d="M14.5 6 8.5 12l6 6" />,
  chevron_right: <path d="M9.5 6l6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4-4" />
    </>
  ),
  add: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M4 20h4L19.2 8.8a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M14.7 6.8l2.5 2.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v5h-5" />
    </>
  ),
  water_drop: <path d="M12 3.5s6 6.3 6 10.2a6 6 0 0 1-12 0C6 9.8 12 3.5 12 3.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  notifications: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </>
  ),
};

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
