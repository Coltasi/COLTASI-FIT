import { TimezoneCookie } from "@/components/timezone-cookie";
import { TabBar } from "@/components/tab-bar";
import { OfflineSupport } from "@/components/offline-support";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <TimezoneCookie />
      <OfflineSupport />
      {children}
      <TabBar />
    </>
  );
}
