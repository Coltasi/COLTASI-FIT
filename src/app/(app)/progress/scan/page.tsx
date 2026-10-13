import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { ScanForm } from "./scan-form";

export default async function ScanPage() {
  const { user, today } = await getContext();
  return (
    <main className="screen">
      <BackHeader href="/progress" label="Progress" eyebrow="Tanita · today" title="Add scan" />
      <ScanForm userId={user.id} today={today} />
    </main>
  );
}
