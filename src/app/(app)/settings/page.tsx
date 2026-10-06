import Link from "next/link";
import { BackHeader, SectionLabel } from "@/components/ui";
import { IconChevron } from "@/components/icons";
import { displayName, getContext } from "@/lib/data";
import { signOut } from "@/app/actions/auth";
import { PrefToggle, UnitsToggle } from "./toggles";

export default async function SettingsPage() {
  const { supabase, user, profile, units } = await getContext();
  const [{ data: hh }, { data: members }] = await Promise.all([
    profile.household_id ? supabase.from("households").select("name, invite_code").eq("id", profile.household_id).single() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id, display_name").neq("id", user.id),
  ]);
  const name = displayName(profile, user.email);
  const others = (members ?? []) as any[];
  const rate = profile.target_rate_kg_week;
  const kbs = profile.kettlebells_kg ?? [];

  return (
    <main className="screen" style={{ gap: 20 }}>
      <BackHeader href="/" label="Overview" title="Settings" />

      <div>
        <SectionLabel>Account</SectionLabel>
        <div className="card clip">
          <Link href="/settings/profile" className="row" style={{ minHeight: 72, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="disp" style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--navy)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{name.slice(0, 1).toUpperCase()}</span>
              <div><p style={{ fontSize: 15, fontWeight: 600 }}>{name}</p><p className="cap">{user.email}</p></div>
            </div>
            <IconChevron />
          </Link>
          <details className="row" style={{ display: "block" }}>
            <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 32 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Manage household</span>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>{others.length ? `${others.length} other login${others.length > 1 ? "s" : ""}` : "just you"}</span>
            </summary>
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {others.map((m) => <p key={m.id} className="cap">• {m.display_name ?? "Member"}</p>)}
              <p className="cap" style={{ lineHeight: 1.45 }}>
                To add someone, have them create an account and enter this invite code: <b className="num" style={{ color: "var(--navy)", letterSpacing: ".08em" }}>{hh?.invite_code ?? "–"}</b>. They get their own private data.
              </p>
            </div>
          </details>
          <form action={signOut}>
            <button type="submit" className="row" style={{ width: "100%", background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, textAlign: "left", cursor: "pointer", minHeight: 56 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--rust)" }}>Sign out</span>
            </button>
          </form>
        </div>
      </div>

      <div>
        <SectionLabel>Profile &amp; units</SectionLabel>
        <div className="card clip">
          <Link href="/settings/profile" className="row" style={{ minHeight: 56, justifyContent: "space-between" }}>
            <div><p style={{ fontSize: 15, fontWeight: 600 }}>Body stats</p><p className="cap">Height, sex, age, TDEE and targets</p></div>
            <IconChevron />
          </Link>
          <div className="row" style={{ minHeight: 56, justifyContent: "space-between" }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Units</p>
            <UnitsToggle units={units} />
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Program &amp; goals</SectionLabel>
        <div className="card clip">
          {[
            ["Current phase", profile.phase ? profile.phase[0].toUpperCase() + profile.phase.slice(1) : "–"],
            ["Target rate", rate == null ? "Not set" : `${rate > 0 ? "+" : rate < 0 ? "−" : ""}${Math.abs(Number(rate))} kg/week`],
            ["Kettlebells on hand", kbs.length ? `${Math.min(...kbs)} to ${Math.max(...kbs)} kg` : "None"],
          ].map(([l, v]) => (
            <Link key={l} href="/settings/profile" className="row" style={{ minHeight: 56, justifyContent: "space-between" }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{l}</p>
              <span style={{ fontSize: 14, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>{v} <IconChevron /></span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Notifications</SectionLabel>
        <div className="card clip">
          <div className="row" style={{ minHeight: 56, justifyContent: "space-between" }}>
            <div><p style={{ fontSize: 15, fontWeight: 600 }}>Weekly weigh-in</p><p className="cap">Mondays at {profile.weigh_in_time?.slice(0, 5) ?? "07:30"}</p></div>
            <PrefToggle field="notify_weigh_in" on={profile.notify_weigh_in} label="Weekly weigh-in reminder" />
          </div>
          <div className="row" style={{ minHeight: 56, justifyContent: "space-between" }}>
            <div><p style={{ fontSize: 15, fontWeight: 600 }}>Workout day</p><p className="cap">Split days at {profile.workout_time?.slice(0, 5) ?? "08:00"}</p></div>
            <PrefToggle field="notify_workout" on={profile.notify_workout} label="Workout day reminder" />
          </div>
        </div>
        <p className="cap" style={{ marginTop: 8, marginLeft: 4 }}>Your choices are saved. Phone notifications switch on in a later update.</p>
      </div>

      <div>
        <SectionLabel>Data</SectionLabel>
        <div className="card clip">
          <a href="/settings/export" className="row" style={{ minHeight: 56, justifyContent: "space-between" }} download>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Export my data</p><IconChevron />
          </a>
          <div className="row" style={{ minHeight: 56, justifyContent: "space-between" }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>About Coltasi</p><span className="cap">v3</span>
          </div>
        </div>
      </div>
    </main>
  );
}
