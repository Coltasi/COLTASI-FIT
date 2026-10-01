"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";
import { toKg, unit, w, type Units } from "@/lib/units";
import { fmtShort } from "@/lib/dates";
import type { LastTime } from "@/lib/data";
import { addExercise, addSet, finishSession, saveSet, setExtra } from "../../actions";

export type SSet = { id: string; set_no: number; weight_kg: number | null; reps: number | null; done: boolean };
export type SEx = { id: string; name: string; plan: string; last: LastTime | null; sets: SSet[] };
type Session = {
  id: string; kind: string; title: string; status: string;
  warmup: string | null; warmup_done: boolean; finisher: string | null; finisher_done: boolean;
  cooldown: boolean; cooldown_done: boolean;
};

const WARMUP_LABEL: Record<string, string> = { stairs: "Stairs", elliptical: "Elliptical", treadmill: "Treadmill", rower: "Rower" };
const isDone = (e: SEx) => e.sets.length > 0 && e.sets.every((s) => s.done);

function Dot({ done, dashed }: { done: boolean; dashed?: boolean }) {
  return done ? (
    <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--navy)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconCheck size={14} /></span>
  ) : (
    <span style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px ${dashed ? "dashed" : "solid"} var(--check-line)`, flexShrink: 0 }} />
  );
}

export function SessionView({ session, exercises: initial, units }: { session: Session; exercises: SEx[]; units: Units }) {
  const [exs, setExs] = useState(initial);
  const [extras, setExtras] = useState({ warmup_done: session.warmup_done, finisher_done: session.finisher_done, cooldown_done: session.cooldown_done });
  const firstOpen = exs.find((e) => !isDone(e))?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(firstOpen);
  const [pending, start] = useTransition();
  const doneCount = exs.filter(isDone).length;
  const readOnly = session.status !== "in_progress";

  const label = session.kind === "custom" ? "Custom" : session.kind === "kettlebell" ? "Kettlebell" : "The Split";

  function patchSet(exId: string, setId: string, patch: Partial<SSet>) {
    setExs((prev) => {
      const next = prev.map((e) => (e.id !== exId ? e : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));
      const ex = next.find((e) => e.id === exId);
      if (ex && isDone(ex) && patch.done) setOpenId(next.find((e) => !isDone(e))?.id ?? null);
      return next;
    });
  }

  function toggleExtra(field: keyof typeof extras) {
    const v = !extras[field];
    setExtras({ ...extras, [field]: v });
    start(() => setExtra(session.id, field, v));
  }

  const doneList = exs.filter((e) => isDone(e) && e.id !== openId);
  const open = exs.find((e) => e.id === openId) ?? null;
  const upcoming = exs.filter((e) => !isDone(e) && e.id !== openId);

  return (
    <main className="screen">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p className="lab" style={{ color: readOnly ? "var(--muted)" : "var(--rust)" }}>{readOnly ? "Logged" : "In progress"} · {label}</p>
          <h1 className="disp" style={{ fontSize: 30, marginTop: 2 }}>{session.title}</h1>
          {session.kind === "custom" ? <p className="cap" style={{ marginTop: 4 }}>No plan. Build it as you go.</p> : null}
        </div>
        {readOnly ? null : <Link href={`/train/session/${session.id}/edit`} className="btn2" style={{ marginTop: 6 }}>Edit</Link>}
      </div>

      {exs.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {exs.map((e) => (
              <div key={e.id} style={{ height: 6, borderRadius: 3, flex: 1, background: isDone(e) ? "var(--navy)" : e.id === openId ? "var(--ember)" : "var(--line-strong)" }} />
            ))}
          </div>
          <p className="cap"><span className="num" style={{ color: "var(--navy)" }}>{doneCount}</span> of {exs.length} lifts done</p>
        </div>
      ) : null}

      {(session.warmup || doneList.length) ? (
        <div className="card clip">
          {session.warmup ? (
            <button type="button" className="row" onClick={() => !readOnly && toggleExtra("warmup_done")} style={{ width: "100%", background: "none", border: 0, textAlign: "left", cursor: "pointer" }}>
              <Dot done={extras.warmup_done} />
              <div style={{ flexGrow: 1 }}><p className="ln" style={{ color: extras.warmup_done ? "var(--muted)" : "var(--navy)" }}>Warm-up · {WARMUP_LABEL[session.warmup] ?? session.warmup}</p><p className="cap">10 min</p></div>
            </button>
          ) : null}
          {doneList.map((e) => (
            <button key={e.id} type="button" className="row" onClick={() => setOpenId(e.id)} style={{ width: "100%", background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, textAlign: "left", cursor: "pointer" }}>
              <Dot done />
              <div style={{ flexGrow: 1 }}>
                <p className="ln" style={{ color: "var(--muted)" }}>{e.name}</p>
                <p className="cap">{summary(e, units)}</p>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {open ? <ExerciseCard key={open.id} ex={open} units={units} readOnly={readOnly} onPatch={patchSet} onAddSet={(s) => setExs((prev) => prev.map((e) => (e.id === open.id ? { ...e, sets: [...e.sets, s] } : e)))} /> : null}

      {(upcoming.length || session.finisher || session.cooldown) ? (
        <div className="card clip">
          {upcoming.map((e) => (
            <button key={e.id} type="button" className="row" onClick={() => setOpenId(e.id)} style={{ width: "100%", background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, textAlign: "left", cursor: "pointer" }}>
              <Dot done={false} />
              <div style={{ flexGrow: 1 }}>
                <p className="ln">{e.name}</p>
                <p className="cap">{e.plan}{e.last?.top != null ? ` · last ${w(e.last.top, units)} ${unit(units)}` : ""}</p>
              </div>
            </button>
          ))}
          {session.finisher ? (
            <button type="button" className="row" onClick={() => !readOnly && toggleExtra("finisher_done")} style={{ width: "100%", background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, textAlign: "left", cursor: "pointer" }}>
              <Dot done={extras.finisher_done} dashed />
              <div style={{ flexGrow: 1 }}><p className="ln">Ab finisher · {session.finisher}</p></div>
            </button>
          ) : null}
          {session.cooldown ? (
            <button type="button" className="row" onClick={() => !readOnly && toggleExtra("cooldown_done")} style={{ width: "100%", background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, textAlign: "left", cursor: "pointer" }}>
              <Dot done={extras.cooldown_done} dashed />
              <div style={{ flexGrow: 1 }}><p className="ln">Cool-down · 5 min</p><p className="cap">Stretch and breathing</p></div>
            </button>
          ) : null}
        </div>
      ) : null}

      {session.kind === "custom" && !readOnly ? <AddExerciseInline sessionId={session.id} units={units} /> : null}
      {session.kind === "custom" ? <p className="cap">Saves to History and Lifting Progress like any other session.</p> : null}

      {readOnly ? null : (
        <form action={finishSession.bind(null, session.id)} className="dock">
          <div><button className="btn" type="submit" disabled={pending}>Finish workout</button></div>
        </form>
      )}
    </main>
  );
}

function summary(e: SEx, units: Units) {
  const done = e.sets.filter((s) => s.done);
  const ws = [...new Set(done.map((s) => (s.weight_kg == null ? null : w(s.weight_kg, units))).filter(Boolean))];
  const reps = done.map((s) => s.reps ?? "?").join(", ");
  return ws.length ? `${ws.join(" · ")} ${unit(units)} · ${reps}` : `${reps} reps`;
}

function ExerciseCard({ ex, units, readOnly, onPatch, onAddSet }: {
  ex: SEx; units: Units; readOnly: boolean;
  onPatch: (exId: string, setId: string, patch: Partial<SSet>) => void;
  onAddSet: (s: SSet) => void;
}) {
  const [vals, setVals] = useState<Record<string, { w: string; r: string }>>(() =>
    Object.fromEntries(ex.sets.map((s) => [s.id, { w: s.weight_kg == null ? "" : w(s.weight_kg, units), r: s.reps == null ? "" : String(s.reps) }])),
  );
  const [, start] = useTransition();
  const current = ex.sets.find((s) => !s.done)?.id;

  const placeholder = useMemo(() => {
    return (s: SSet) => {
      const prevSet = ex.sets.filter((z) => z.set_no < s.set_no && z.done).at(-1);
      const lastSame = ex.last?.sets[s.set_no - 1] ?? ex.last?.sets.at(-1);
      const kg = prevSet?.weight_kg ?? lastSame?.weight_kg ?? ex.last?.top ?? null;
      const reps = lastSame?.reps ?? prevSet?.reps ?? null;
      return { w: kg == null ? "" : w(kg, units), r: reps == null ? "" : String(reps) };
    };
  }, [ex.sets, ex.last, units]);

  function toggle(s: SSet) {
    const v = vals[s.id] ?? { w: "", r: "" };
    const ph = placeholder(s);
    const wStr = v.w || ph.w;
    const rStr = v.r || ph.r;
    const kg = wStr ? toKg(Number(wStr), units) : null;
    const reps = rStr ? Number(rStr) : null;
    const done = !s.done;
    if (done) setVals({ ...vals, [s.id]: { w: wStr, r: rStr } });
    onPatch(ex.id, s.id, { done, weight_kg: kg, reps });
    start(() => saveSet(s.id, kg, reps, done));
  }

  const fld = (active: boolean, done: boolean): CSSProperties => ({
    width: "100%", height: 44, borderRadius: 10, textAlign: "center", fontWeight: 700, fontSize: 17, fontVariantNumeric: "tabular-nums",
    border: `1px solid ${active ? "var(--ember)" : done ? "var(--line)" : "var(--line-strong)"}`,
    background: done ? "#fff" : "var(--field)", color: done ? "var(--muted)" : "var(--navy)",
  });

  return (
    <div className="card" style={{ padding: 16, border: "2px solid var(--ember)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h2 className="disp" style={{ fontSize: 22 }}>{ex.name}</h2>
        <p className="cap" style={{ flexShrink: 0 }}>{ex.plan}</p>
      </div>
      {ex.last ? (
        <p className="cap" style={{ marginTop: 4 }}>
          Last time <span style={{ color: "var(--navy)", fontWeight: 600 }}>
            {ex.last.top != null ? `${w(ex.last.top, units)} ${unit(units)} × ` : ""}{ex.last.sets.map((s) => s.reps ?? "?").join(", ")}
          </span> · {fmtShort(ex.last.date)}
        </p>
      ) : <p className="cap" style={{ marginTop: 4 }}>First time logging this one.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) minmax(0,1fr) 44px", gap: 8, alignItems: "center", margin: "14px 0 6px" }}>
        <span className="lab" style={{ fontSize: 10 }}>Set</span>
        <span className="lab" style={{ fontSize: 10, textAlign: "center" }}>{unit(units)}</span>
        <span className="lab" style={{ fontSize: 10, textAlign: "center" }}>Reps</span>
        <span />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ex.sets.map((s) => {
          const v = vals[s.id] ?? { w: "", r: "" };
          const ph = placeholder(s);
          const active = s.id === current && !readOnly;
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) minmax(0,1fr) 44px", gap: 8, alignItems: "center" }}>
              <span className="num" style={{ color: active ? "var(--rust)" : "var(--muted)" }}>{s.set_no}</span>
              <label><span className="sr-only">Set {s.set_no} weight in {unit(units)}</span>
                <input inputMode="decimal" value={v.w} placeholder={ph.w} disabled={readOnly} style={fld(active, s.done)}
                  onChange={(e) => setVals({ ...vals, [s.id]: { ...v, w: e.target.value.replace(",", ".") } })} />
              </label>
              <label><span className="sr-only">Set {s.set_no} reps</span>
                <input inputMode="numeric" value={v.r} placeholder={ph.r} disabled={readOnly} style={fld(active, s.done)}
                  onChange={(e) => setVals({ ...vals, [s.id]: { ...v, r: e.target.value.replace(/\D/g, "") } })} />
              </label>
              <button type="button" className={`chk${s.done ? " on" : ""}`} aria-pressed={s.done} aria-label={`Set ${s.set_no} done`} disabled={readOnly} onClick={() => toggle(s)}>
                {s.done ? <IconCheck size={18} /> : null}
              </button>
            </div>
          );
        })}
      </div>
      {readOnly ? null : (
        <button type="button" className="btn2" style={{ marginTop: 12, width: "100%" }}
          onClick={() => start(async () => { const s = await addSet(ex.id); onAddSet({ ...s, weight_kg: null, reps: null, done: false }); setVals((p) => ({ ...p, [s.id]: { w: "", r: "" } })); })}>
          + Add set
        </button>
      )}
    </div>
  );
}

function AddExerciseInline({ sessionId, units }: { sessionId: string; units: Units }) {
  const [pending, start] = useTransition();
  const [key, setKey] = useState(0);
  const router = useRouter();
  return (
    <form
      key={key}
      className="card"
      style={{ padding: "12px 14px 14px 16px" }}
      action={(fd) => {
        const raw = Number(String(fd.get("weight") ?? "").replace(",", "."));
        if (raw) fd.set("weight_kg", String(toKg(raw, units)));
        start(async () => { await addExercise(sessionId, fd); setKey((k) => k + 1); router.refresh(); });
      }}
    >
      <p className="lab" style={{ marginBottom: 8, color: "var(--kingfisher-text)" }}>Add exercise</p>
      <div style={{ display: "grid", gap: 8 }}>
        <label><span className="sr-only">Exercise name</span><input name="name" className="fld" placeholder="Exercise name" required /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr)) 48px", gap: 6 }}>
          <label><span className="sr-only">Sets</span><input name="sets" className="fld" placeholder="Sets" inputMode="numeric" style={{ padding: "0 10px" }} /></label>
          <label><span className="sr-only">Reps</span><input name="reps" className="fld" placeholder="Reps" style={{ padding: "0 10px" }} /></label>
          <label><span className="sr-only">Weight in {unit(units)}</span><input name="weight" className="fld" placeholder={unit(units)} inputMode="decimal" style={{ padding: "0 10px" }} /></label>
          <button type="submit" aria-label="Add exercise" disabled={pending} style={{ height: 48, borderRadius: 12, border: 0, background: "var(--ember)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>+</span>
          </button>
        </div>
      </div>
    </form>
  );
}
