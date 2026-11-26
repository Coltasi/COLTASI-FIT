import { BackHeader } from "@/components/ui";
import { getContext } from "@/lib/data";
import { LIBRARY_GROUPS } from "@/lib/exercise-guides";
import { LibraryList } from "./library-list";

export default async function LibraryPage() {
  const { supabase } = await getContext();
  const { data } = await supabase.from("exercises").select("id, name").is("created_by", null);
  const idByName = new Map(((data ?? []) as { id: string; name: string }[]).map((e) => [e.name, e.id]));
  const groups = LIBRARY_GROUPS
    .map(([g, names]) => ({ name: g, items: names.filter((n) => idByName.has(n)).map((n) => ({ id: idByName.get(n)!, name: n })) }))
    .filter((g) => g.items.length);
  // Library exercises not placed in a section above still show, so nothing in the library is hidden.
  const placed = new Set(LIBRARY_GROUPS.flatMap(([, names]) => names));
  const more = [...idByName].filter(([n]) => !placed.has(n)).sort(([a], [b]) => a.localeCompare(b)).map(([name, id]) => ({ id, name }));
  if (more.length) groups.push({ name: "More", items: more });

  return (
    <main className="screen">
      <BackHeader href="/train" label="Train" title="Exercise library" />
      <LibraryList groups={groups} />
    </main>
  );
}
