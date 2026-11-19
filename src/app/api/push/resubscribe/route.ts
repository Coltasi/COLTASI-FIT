import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/user";

/**
 * Called by the service worker when Chrome replaces this phone's push address
 * (pushsubscriptionchange). Saves the new address and drops the old one, keeping the time zone.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const endpoint = String(b?.endpoint ?? "");
  if (!endpoint.startsWith("https://") || !b?.p256dh || !b?.auth) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  const old = b?.oldEndpoint ? String(b.oldEndpoint) : null;
  const { data: prev } = old ? await supabase.from("push_subscriptions").select("timezone").eq("endpoint", old).maybeSingle() : { data: null };
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh: String(b.p256dh), auth: String(b.auth), timezone: prev?.timezone ?? "Europe/Madrid", user_agent: (req.headers.get("user-agent") ?? "").slice(0, 200), last_seen: new Date().toISOString() },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (old && old !== endpoint) await supabase.from("push_subscriptions").delete().eq("endpoint", old);
  return NextResponse.json({ ok: true });
}
