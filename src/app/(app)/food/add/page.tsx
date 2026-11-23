import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { FOOD_DAYS_BACK } from "@/lib/energy";
import { AddFood } from "./add-food";

export default async function AddFoodPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { supabase, today } = await getContext();
  const sp = await searchParams;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today && sp.day >= addDays(today, -FOOD_DAYS_BACK) ? sp.day : today;
  const { data: saved } = await supabase.from("saved_foods").select("id, name, kcal, protein_g").order("use_count", { ascending: false }).order("name").limit(30);
  return (
    <main className="screen">
      <BackHeader href={day === today ? "/food" : `/food?day=${day}`} label="Food" eyebrow={day === today ? "Today" : day} title="Add food" />
      <AddFood day={day} back={day === today ? "/food" : `/food?day=${day}`}
        saved={((saved ?? []) as any[]).map((s) => ({ id: s.id, name: s.name, kcal: Number(s.kcal), protein_g: Number(s.protein_g) }))} />
    </main>
  );
}
