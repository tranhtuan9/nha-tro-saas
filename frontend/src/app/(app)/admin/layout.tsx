import { RequireRole } from "@/components/guards";

export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <RequireRole role="ADMIN">{children}</RequireRole>;
}