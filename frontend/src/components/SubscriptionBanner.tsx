"use client";

import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";

/**
 * Luật 12: Tenant hết hạn vẫn đăng nhập và xem được dữ liệu, chỉ chặn tạo mới.
 * Biểu ngữ hiển thị cho Landlord trên mọi màn hình thuộc AppShell.
 */
export function SubscriptionBanner() {
  const { user, subscriptionExpired, subscriptionEnd } = useAuth();

  if (user?.role !== "LANDLORD" || !subscriptionExpired) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2.5 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-text ring-1 ring-inset ring-amber-200"
    >
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="leading-relaxed">
        <p className="font-semibold">
          Gói dịch vụ đã hết hạn
          {subscriptionEnd ? ` (hết hạn ${formatDate(subscriptionEnd)})` : ""}
        </p>
        <p className="text-xs">
          Bạn vẫn xem được dữ liệu hiện có, nhưng không thể tạo mới. Liên hệ quản trị viên để gia hạn gói.
        </p>
      </div>
    </div>
  );
}
