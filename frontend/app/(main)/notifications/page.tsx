import type { Metadata } from "next";
import { NotificationsView } from "@/features/notifications/components/NotificationsView";

export const metadata: Metadata = {
  title: "Thông báo | MXH",
  description: "Xem các tương tác và thông báo mới nhất gửi đến bạn.",
};

export default function NotificationsPage() {
  return <NotificationsView />;
}
