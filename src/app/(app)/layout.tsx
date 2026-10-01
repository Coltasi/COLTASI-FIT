import { TimezoneCookie } from "@/components/timezone-cookie";
import { TabBar } from "@/components/tab-bar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <TimezoneCookie />
      {children}
      <TabBar />
    </>
  );
}
