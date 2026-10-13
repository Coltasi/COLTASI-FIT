import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { LIBRARY_GROUPS } from "@/lib/exercise-guides";
import { LibraryList } from "./library-list";

export default async function LibraryPage() {
  const { supabase } = await getContext();
  const { data } = await supabase.from("exercises").select("id, name").is("created_by", null);
  const idByName = new Map(((data ?? []) as any[]).map((e) => [e.name as string, e.id as string]));
  const groups = LIBRARY_GROUPS
    .map(([g, names]) => ({ name: g, items: names.filter((n) => idByName.has(n)).map((n) => ({ id: idByName.get(n)!, name: n })) }))
    .filter((g) => g.items.length);

  return (
    <main className="screen">
      <BackHeader href="/train" label="Train" title="Exercise library" />
      <LibraryList groups={groups} />
    </main>
  );
}
