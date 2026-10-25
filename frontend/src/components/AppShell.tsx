"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import { getInitials } from "@/lib/format";
import { getNavForRole, ROLE_LABELS, type NavItem } from "@/lib/navigation";

const OVERVIEW_SUBPATHS: Record<string, string[]> = {
  "/renter/overview": ["/renter/contract", "/renter/meter-readings"],
};

function NavLinks({ nav, pathname, onNavigate }: { nav: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 px-3 py-4">
      {nav.map((item) => {
        const subpaths = OVERVIEW_SUBPATHS[item.href] ?? [];
        const active =
          pathname === item.href ||
          pathname.startsWith(`${item.href}/`) ||
          subpaths.includes(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
              active
                ? "bg-primary-soft font-semibold text-primary"
                : "text-muted hover:bg-surface-container hover:text-ink",
            )}
          >
            {active && (
              <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-primary" />
            )}
            <Icon name={item.icon} className="h-5 w-5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, tenantName, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
    setMenuOpen(false);
  }

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!user) return null;

  const nav = getNavForRole(user.role);
  const profileHref = `/${user.role.toLowerCase()}/profile`;
  const notificationsHref = `/${user.role.toLowerCase()}/notifications`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-border px-4">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavLinks nav={nav} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-60 bg-surface shadow-dropdown">{sidebar}</aside>
        </div>
      )}

      <header className="fixed inset-x-0 top-0 z-20 h-16 border-b border-border bg-surface lg:left-60">
        <div className="flex h-full items-center justify-between gap-4 px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu điều hướng"
              className="rounded-lg p-2 text-muted hover:bg-surface-container hover:text-ink lg:hidden"
            >
              <Icon name="menu" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {tenantName ?? "Quản trị hệ thống"}
              </p>
              <p className="truncate text-xs text-muted">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user.role !== "ADMIN" && <NotificationBell href={notificationsHref} />}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                className="flex h-10 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-surface-container"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                  {getInitials(user.fullName)}
                </span>
                <span className="hidden max-w-40 truncate text-sm font-medium text-ink sm:block">
                  {user.fullName}
                </span>
                <Icon name="chevron_down" className="h-4 w-4 text-muted" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 w-60 rounded-lg border border-border bg-surface p-1 shadow-dropdown">
                  <div className="border-b border-border px-3 py-2">
                    <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <Link
                    href={profileHref}
                    className="mt-1 flex h-10 items-center gap-2 rounded-md px-3 text-sm text-ink hover:bg-surface-container"
                  >
                    <Icon name="person" className="h-4 w-4 text-muted" />
                    Hồ sơ cá nhân
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-danger hover:bg-danger-soft"
                  >
                    <Icon name="logout" className="h-4 w-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-16 lg:pl-60">
        <div className="p-4 lg:p-8">
          <SubscriptionBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
