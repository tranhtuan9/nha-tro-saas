import { RequireRole } from "@/components/guards";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <RequireRole role="ADMIN">{children}</RequireRole>;
}