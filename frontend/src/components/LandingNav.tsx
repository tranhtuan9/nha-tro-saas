"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getHomePathForRole } from "@/lib/navigation";

export function LandingNav() {
  const { user } = useAuth();

  if (user) {
    const dashboardHref = getHomePathForRole(user.role);
    return (
      <nav className="flex items-center gap-3 sm:gap-4">
        <Link
          href={dashboardHref}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:translate-y-px transition-all"
        >
          Vào trang quản lý →
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3 sm:gap-4">
      <Link
        href="/login"
        className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 transition-colors"
      >
        Đăng nhập
      </Link>
      <Link
        href="/register"
        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:translate-y-px transition-all"
      >
        Bắt đầu miễn phí
      </Link>
    </nav>
  );
}
