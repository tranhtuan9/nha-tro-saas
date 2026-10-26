import { RequireRole } from "@/components/guards";

export const instant = false;

export default function LandlordLayout({ children }: LayoutProps<"/landlord">) {
  return <RequireRole role="LANDLORD">{children}</RequireRole>;
}