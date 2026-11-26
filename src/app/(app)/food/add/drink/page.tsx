import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { FOOD_DAYS_BACK } from "@/lib/energy";
import { DrinkForm } from "./drink-form";

export default async function AddDrinkPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { today } = await getContext();
  const sp = await searchParams;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today && sp.day >= addDays(today, -FOOD_DAYS_BACK) ? sp.day : today;
  const back = day === today ? "/food/add" : `/food/add?day=${day}`;
  return (
    <main className="screen">
      <BackHeader href={back} label="Add food" eyebrow={day === today ? "Today" : day} title="Add a drink" />
      <DrinkForm day={day} done={day === today ? "/food" : `/food?day=${day}`} />
    </main>
  );
}
