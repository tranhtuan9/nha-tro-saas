import { RequireRole } from "@/components/guards";

export const instant = false;

export default function RenterLayout({ children }: LayoutProps<"/renter">) {
  return <RequireRole role="RENTER">{children}</RequireRole>;
}