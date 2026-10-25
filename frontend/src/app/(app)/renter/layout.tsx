import { RequireRole } from "@/components/guards";

export default function RenterLayout({ children }: LayoutProps<"/renter">) {
  return <RequireRole role="RENTER">{children}</RequireRole>;
}