"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getHomePathForRole } from "@/lib/navigation";
import type { Role } from "@/lib/types";

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Đang tải</span>
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [token, pathname, router]);

  if (!token || !user) return <FullScreenSpinner />;
  return <>{children}</>;
}

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== role) {
      router.replace(getHomePathForRole(user.role));
    }
  }, [user, role, router]);

  if (!user || user.role !== role) return <FullScreenSpinner />;
  return <>{children}</>;
}
