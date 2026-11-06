import type { Role } from "./types";

export type IconName =
  | "dashboard"
  | "apartment"
  | "meeting_room"
  | "badge"
  | "bolt"
  | "receipt_long"
  | "feedback"
  | "smart_toy"
  | "manage_accounts"
  | "person"
  | "domain"
  | "logout"
  | "chevron_down"
  | "chevron_left"
  | "chevron_right"
  | "menu"
  | "close"
  | "eye"
  | "eye_off"
  | "mail"
  | "lock"
  | "check"
  | "info"
  | "alert"
  | "success"
  | "construction"
  | "search"
  | "add"
  | "edit"
  | "refresh"
  | "water_drop"
  | "clock"
  | "notifications";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const LANDLORD_NAV: NavItem[] = [
  { href: "/landlord/overview", label: "Tổng quan", icon: "dashboard" },
  { href: "/landlord/properties", label: "Nhà trọ & phòng", icon: "meeting_room" },
  { href: "/landlord/renters", label: "Người thuê & hợp đồng", icon: "badge" },
  { href: "/landlord/meters-services", label: "Điện nước & dịch vụ", icon: "bolt" },
  { href: "/landlord/invoices", label: "Hóa đơn", icon: "receipt_long" },
  { href: "/landlord/feedback", label: "Phản ánh", icon: "feedback" },
  { href: "/landlord/ai", label: "Trợ lý AI", icon: "smart_toy" },
  { href: "/landlord/notifications", label: "Thông báo", icon: "notifications" },
  { href: "/landlord/profile", label: "Hồ sơ cá nhân", icon: "manage_accounts" },
];

const RENTER_NAV: NavItem[] = [
  { href: "/renter/overview", label: "Tổng quan", icon: "dashboard" },
  { href: "/renter/invoices", label: "Hóa đơn & thanh toán", icon: "receipt_long" },
  { href: "/renter/feedback", label: "Phản ánh", icon: "feedback" },
  { href: "/renter/notifications", label: "Thông báo", icon: "notifications" },
  { href: "/renter/profile", label: "Hồ sơ cá nhân", icon: "person" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/tenants", label: "Nhà trọ & Gói dịch vụ", icon: "domain" },
  { href: "/admin/users", label: "Người dùng", icon: "manage_accounts" },
  { href: "/admin/profile", label: "Hồ sơ cá nhân", icon: "badge" },
];

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  LANDLORD: LANDLORD_NAV,
  RENTER: RENTER_NAV,
  ADMIN: ADMIN_NAV,
};

export function getNavForRole(role: Role): NavItem[] {
  return NAV_BY_ROLE[role];
}

export function getHomePathForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin/tenants";
    case "LANDLORD":
      return "/landlord/overview";
    case "RENTER":
      return "/renter/overview";
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  LANDLORD: "Chủ nhà trọ",
  RENTER: "Người thuê",
};
