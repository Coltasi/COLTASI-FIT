import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { fmtDay } from "@/lib/dates";
import { ScanForm } from "./scan-form";

export default async function ScanPage() {
  const { user, today } = await getContext();
  return (
    <main className="screen">
      <BackHeader href="/progress" label="Progress" eyebrow={`Tanita · ${fmtDay(today)}`} title="Log a scan" />
      <ScanForm userId={user.id} today={today} />
    </main>
  );
}
