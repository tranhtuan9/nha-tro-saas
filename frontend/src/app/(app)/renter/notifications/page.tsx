import { NotificationsView } from "@/components/NotificationsView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function RenterNotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Người thuê phòng / Thông báo" title="Thông báo" description="Thông báo hóa đơn mới, xác nhận thanh toán." />
      <NotificationsView />
    </div>
  );
}
