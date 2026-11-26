// Sends the daily sleep and Mon/Wed/Fri weigh-in push reminders.
// Called every 15 minutes by pg_cron (see the push_reminders migration).
// Only sends when the thing is not already logged, and at most once per day per kind.
// A reminder only counts as sent (reminder_log) when at least one device accepted it.
// Also handles {"test": true} from a signed-in user: sends a test notification to their devices.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// A reminder is due from its set time until this many minutes later, so one late
// or missed cron run does not skip a day.
const CATCH_UP_MIN = 90;

async function secret(name: string): Promise<string> {
  const { data, error } = await admin.rpc("get_reminder_secret", { secret_name: name });
  if (error || !data) throw new Error(`missing secret ${name}`);
  return data as string;
}

function localParts(tz: string, d = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), dow: p.weekday };
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const toMin = (t: string) => { const [h, m] = t.split(":"); return Number(h) * 60 + Number(m); };
const due = (now: number, at: number) => now >= at && now < at + CATCH_UP_MIN;

type Kind = "sleep" | "weigh_in" | "weigh_in_nudge";
const MESSAGES: Record<Kind, { title: string; body: string; url: string }> = {
  sleep: { title: "Log last night's sleep", body: "Ten seconds: hours and how you woke up.", url: "/sleep" },
  weigh_in: { title: "Weigh-in day", body: "Before you eat or drink: step on the scale, then log it.", url: "/progress" },
  weigh_in_nudge: { title: "No weigh-in logged this week", body: "Log it now so the trend stays honest.", url: "/progress" },
};

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type PushError = { statusCode?: number; body?: unknown; message?: string };

/** Sends to every device; drops devices the push service says are gone. Returns how many accepted it. */
async function sendToDevices(userSubs: Sub[], payload: string) {
  let ok = 0;
  const errors: string[] = [];
  for (const s of userSubs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
      ok++;
    } catch (err) {
      const e = err as PushError;
      errors.push(`${e?.statusCode ?? "?"} ${String(e?.body ?? e?.message ?? e).slice(0, 120)}`);
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return { ok, errors };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const isCron = req.headers.get("x-cron-secret") === (await secret("reminder_cron_secret"));
    if (!isCron) {
      // Test notification for the signed-in user (Settings → "Send test").
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
      const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
      const body = await req.json().catch(() => ({}));
      if (!u?.user || !body?.test) return new Response("forbidden", { status: 403, headers: CORS });
      webpush.setVapidDetails("https://www.coltasi.com", await secret("vapid_public_key"), await secret("vapid_private_key"));
      const { data: mine } = await admin.from("push_subscriptions").select("*").eq("user_id", u.user.id);
      const r = await sendToDevices(mine ?? [], JSON.stringify({ title: "Test from Coltasi Fit", body: "Reminders reach this phone.", url: "/settings", tag: "test" }));
      return Response.json({ devices: mine?.length ?? 0, delivered: r.ok, errors: r.errors }, { headers: CORS });
    }
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    webpush.setVapidDetails("https://www.coltasi.com", await secret("vapid_public_key"), await secret("vapid_private_key"));

    const { data: subs } = await admin.from("push_subscriptions").select("*");
    const byUser = new Map<string, Sub[]>();
    for (const s of (subs ?? []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
    if (!byUser.size) return Response.json({ users: 0, sent: [] });

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, notify_sleep, sleep_time, notify_weigh_in, weigh_in_time")
      .in("id", [...byUser.keys()]);

    const sent: string[] = [];
    const failed: string[] = [];
    for (const p of profiles ?? []) {
      const userSubs = byUser.get(p.id)!;
      // The most recently seen device decides the time zone, so travel just works.
      const tz = [...userSubs].sort((a, b) => +new Date(b.last_seen) - +new Date(a.last_seen))[0].timezone;
      const { date, minutes, dow } = localParts(tz);

      const kinds: Kind[] = [];
      if (p.notify_sleep && due(minutes, toMin(p.sleep_time))) kinds.push("sleep");
      if (p.notify_weigh_in && due(minutes, toMin(p.weigh_in_time))) {
        // Three a week (Mon, Wed, Fri) so the food log can measure TDEE from a real trend.
        if (dow === "Mon" || dow === "Wed" || dow === "Fri") kinds.push("weigh_in");
      }

      for (const kind of kinds) {
        // Skip when already logged.
        if (kind === "sleep") {
          const { data } = await admin.from("sleep_logs").select("id").eq("user_id", p.id).eq("night_of", addDays(date, -1)).maybeSingle();
          if (data) continue;
        } else {
          const [w, s] = await Promise.all([
            admin.from("weigh_ins").select("id").eq("user_id", p.id).eq("measured_on", date).limit(1),
            admin.from("scans").select("id").eq("user_id", p.id).eq("scanned_on", date).not("weight_kg", "is", null).limit(1),
          ]);
          if (w.data?.length || s.data?.length) continue;
        }

        if (dry) { sent.push(`${p.id}:${kind}:dry`); continue; }

        // Claim first so overlapping runs cannot double send.
        const { data: claimed } = await admin
          .from("reminder_log")
          .upsert({ user_id: p.id, kind, local_date: date }, { onConflict: "user_id,kind,local_date", ignoreDuplicates: true })
          .select();
        if (!claimed?.length) continue;

        const m = MESSAGES[kind];
        const payload = JSON.stringify({ ...m, tag: kind.startsWith("weigh") ? "weigh-in" : "sleep" });
        const r = await sendToDevices(userSubs, payload);
        if (r.ok === 0) {
          // Nothing reached a device: release the claim so it isn't recorded as sent
          // (and a later run inside the catch-up window can try again).
          await admin.from("reminder_log").delete().match({ user_id: p.id, kind, local_date: date });
          console.error(`reminder ${kind} not delivered`, r.errors);
          failed.push(`${p.id}:${kind}`);
          continue;
        }
        sent.push(`${p.id}:${kind}`);
      }
    }
    return Response.json({ users: byUser.size, sent, failed });
  } catch (e) {
    return new Response(String((e as Error).message ?? e), { status: 500 });
  }
});
