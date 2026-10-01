import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const tables = ["sessions", "session_exercises", "session_sets", "weigh_ins", "scans", "sleep_logs", "coach_reads"] as const;
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), email: user.email };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  out.profile = profile;
  for (const t of tables) {
    const { data } = await supabase.from(t).select("*");
    out[t] = data ?? [];
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="coltasi-fit-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
