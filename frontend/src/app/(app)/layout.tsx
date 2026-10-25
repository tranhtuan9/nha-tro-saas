import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/guards";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
