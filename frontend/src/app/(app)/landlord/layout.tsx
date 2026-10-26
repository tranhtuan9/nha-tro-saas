import { RequireRole } from "@/components/guards";

export default function LandlordLayout({ children }: LayoutProps<"/landlord">) {
  return <RequireRole role="LANDLORD">{children}</RequireRole>;
}