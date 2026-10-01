import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { addDays, fmtDay } from "@/lib/dates";
import { SleepForm } from "./sleep-form";

export default async function SleepPage() {
  const { supabase, today } = await getContext();
  const night = addDays(today, -1);
  const { data } = await supabase.from("sleep_logs").select("hours, wake_feeling, flags, note").eq("night_of", night).maybeSingle();
  return (
    <main className="screen">
      <BackHeader href="/" label="Overview" eyebrow={`Last night · ${fmtDay(night)}`} title="Log sleep" />
      <SleepForm night={night} initial={data ? { hours: Number(data.hours), wake_feeling: data.wake_feeling, flags: data.flags ?? [], note: data.note ?? "" } : null} />
    </main>
  );
}
