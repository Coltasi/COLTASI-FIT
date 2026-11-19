import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/user";
import { fetchAll } from "@/lib/fetch-all";

export async function GET() {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) return new Response("Not signed in", { status: 401 });
  const tables = ["sessions", "session_exercises", "session_sets", "weigh_ins", "scans", "sleep_logs", "step_logs", "coach_reads"] as const;
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), email: user.email };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  out.profile = profile;
  for (const t of tables) {
    // Every one of these tables has an id column; page so a long history isn't cut at 1,000 rows.
    out[t] = await fetchAll((a, b) => supabase.from(t).select("*").order("id").range(a, b));
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="coltasi-fit-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
