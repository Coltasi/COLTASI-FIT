"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconPlus } from "@/components/icons";
import { Ring, Sheet, linkBtn } from "@/components/sheet";
import { toKg, unit, w, type Units } from "@/lib/units";
import { fmtShort } from "@/lib/dates";
import { GUIDES } from "@/lib/exercise-guides";
import type { FinisherMove, LastTime } from "@/lib/data";
import { addLifts, addSet, finishSession, saveSet, setExtra, setSessionFinisher, swapLift } from "../../actions";

export type SSet = { id: string; set_no: number; weight_kg: number | null; reps: number | null; done: boolean };
export type SEx = { id: string; exerciseId: string; name: string; plan: string; subFor: string | null; last: LastTime | null; sets: SSet[] };
export type Candidate = { name: string; last: LastTime | null };
type Fin = { name: string; moves: FinisherMove[] };
type Session = {
  id: string; kind: string; title: string;
  warmup: string | null; warmup_done: boolean; cooldown: boolean; cooldown_done: boolean;
  finisher: Fin | null;
};

const WARMUP_LABEL: Record<string, string> = { stairs: "Stairs", elliptical: "Elliptical", treadmill: "Treadmill", rower: "Rower" };
const isDone = (e: SEx) => e.sets.length > 0 && e.sets.every((s) => s.done);
const rowBtn: CSSProperties = { width: "100%", background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, textAlign: "left", cursor: "pointer" };

function Dot({ done, dashed }: { done: boolean; dashed?: boolean }) {
  return done ? (
    <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--navy)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconCheck size={14} /></span>
  ) : (
    <span style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px ${dashed ? "dashed" : "solid"} var(--check-line)`, flexShrink: 0 }} />
  );
}

function Row({ done, dashed, name, sub, muted, onClick }: { done: boolean; dashed?: boolean; name: string; sub?: string; muted?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className="row" onClick={onClick} style={rowBtn}>
      <Dot done={done} dashed={dashed} />
      <div style={{ flexGrow: 1 }}>
        <p className="ln" style={{ color: muted ? "var(--muted)" : "var(--navy)" }}>{name}</p>
        {sub ? <p className="cap">{sub}</p> : null}
      </div>
    </button>
  );
}

export function SessionView({ session, exercises: initial, finishers, candidates, initialOpen, units }: {
  session: Session; exercises: SEx[]; finishers: Fin[]; candidates: Candidate[]; initialOpen: string | null; units: Units;
}) {
  const router = useRouter();
  const [exs, setExs] = useState(initial);
  const [extras, setExtras] = useState({ warmup_done: session.warmup_done, cooldown_done: session.cooldown_done });
  const [openId, setOpenId] = useState<string | null>(() =>
    (initialOpen && initial.some((e) => e.id === initialOpen) ? initialOpen : null) ?? initial.find((e) => !isDone(e))?.id ?? null);
  const [fin, setFin] = useState<Fin | null>(session.finisher);
  const [finOpen, setFinOpen] = useState(false);
  const [sheet, setSheet] = useState<{ mode: "swap" | "add"; ex?: SEx } | null>(() => (session.kind === "custom" && !initial.length ? { mode: "add" } : null));
  const [pending, start] = useTransition();
  const doneCount = exs.filter(isDone).length;
  const label = session.kind === "custom" ? "Custom" : session.kind === "kettlebell" ? "Kettlebell" : "The Split";

  // Save finisher edits shortly after typing stops; ticks save right away.
  const finTimer = useRef<number | undefined>(undefined);
  function saveFin(next: Fin | null, now = false) {
    setFin(next);
    window.clearTimeout(finTimer.current);
    const go = () => start(() => setSessionFinisher(session.id, next));
    if (now) go(); else finTimer.current = window.setTimeout(go, 600);
  }
  useEffect(() => () => window.clearTimeout(finTimer.current), []);

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

  function applySheet(names: string[]) {
    const s = sheet;
    if (!s || !names.length) { setSheet(null); return; }
    start(async () => {
      const newId = s.mode === "swap" && s.ex ? await swapLift(session.id, s.ex.id, names) : await addLifts(session.id, names);
      setSheet(null);
      router.replace(newId ? `/train/session/${session.id}?open=${newId}` : `/train/session/${session.id}`, { scroll: false });
      router.refresh();
    });
  }

  // Plan order: rows before the open lift (warm-up first), the open lift, rows after it.
  const openPos = exs.findIndex((e) => e.id === openId);
  const cut = openPos < 0 ? exs.length : openPos;
  const open = openPos < 0 ? null : exs[openPos];
  const exRow = (e: SEx) => isDone(e)
    ? <Row key={e.id} done muted name={e.name} sub={summary(e, units)} onClick={() => setOpenId(e.id)} />
    : <Row key={e.id} done={false} name={e.name} onClick={() => setOpenId(e.id)}
        sub={`${e.plan}${e.last?.top != null ? ` · last ${w(e.last.top, units)} ${unit(units)}` : ""}${e.subFor ? ` · for ${e.subFor}` : ""}`} />;

  const top: ReactNode[] = [];
  if (session.warmup) top.push(
    <Row key="warmup" done={extras.warmup_done} muted={extras.warmup_done} name={`Warm-up · ${WARMUP_LABEL[session.warmup] ?? session.warmup}`} sub="10 min" onClick={() => toggleExtra("warmup_done")} />,
  );
  exs.slice(0, cut).forEach((e) => top.push(exRow(e)));

  const finDone = !!fin?.moves.length && fin.moves.every((m) => m.done);
  const finCollapsed = !!fin && !finOpen;
  const cooldownRow = session.cooldown
    ? <Row key="cooldown" done={extras.cooldown_done} dashed name="Cool-down · 5 min" sub="Stretch and breathing" onClick={() => toggleExtra("cooldown_done")} />
    : null;
  const bottom: ReactNode[] = exs.slice(openPos < 0 ? exs.length : openPos + 1).map(exRow);
  if (finCollapsed) bottom.push(
    <Row key="finisher" done={finDone} dashed name={`Ab finisher · ${fin!.name}`} onClick={() => setFinOpen(true)}
      sub={`${fin!.moves.filter((m) => m.done).length} of ${fin!.moves.length} done · tap to log or edit`} />,
  );
  if (cooldownRow && (finCollapsed || !fin)) bottom.push(cooldownRow);
  const after = cooldownRow && fin && finOpen ? cooldownRow : null;

  return (
    <main className="screen">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p className="lab" style={{ color: "var(--rust)" }}>In progress · {label}</p>
          <h1 className="disp" style={{ fontSize: 30, marginTop: 2 }}>{session.title}</h1>
          {session.kind === "custom" ? <p className="cap" style={{ marginTop: 4 }}>No plan. Build it as you go.</p> : null}
        </div>
        <Link href={`/train/session/${session.id}/edit`} className="btn2" style={{ marginTop: 6 }}>Edit</Link>
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

      {top.length ? <div className="card clip">{top}</div> : null}

      {open ? (
        <ExerciseCard key={open.id} ex={open} units={units} sessionId={session.id}
          onSwap={() => setSheet({ mode: "swap", ex: open })}
          onPatch={patchSet}
          onAddSet={(s) => setExs((prev) => prev.map((e) => (e.id === open.id ? { ...e, sets: [...e.sets, s] } : e)))} />
      ) : null}

      {bottom.length ? <div className="card clip">{bottom}</div> : null}

      {fin && finOpen ? (
        <FinisherCard fin={fin} finishers={finishers} onChange={saveFin}
          onClose={() => setFinOpen(false)} onSkip={() => { saveFin(null, true); setFinOpen(false); }} />
      ) : null}

      {after ? <div className="card clip">{after}</div> : null}

      <button type="button" onClick={() => setSheet({ mode: "add" })} className="card flat"
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1.5px dashed var(--mist)", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%", color: "var(--navy)" }}>
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--tint-ember)", color: "var(--rust)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconPlus /></span>
        <span><span className="ln" style={{ display: "block" }}>Add exercise</span><span className="cap">{session.kind === "split" ? "Kept for next time" : "Add a lift to this session"}</span></span>
      </button>
      {session.kind === "custom" ? <p className="cap">Saves to History and Lifting Progress like any other session.</p> : null}

      <form action={finishSession.bind(null, session.id)} className="dock">
        <div><button className="btn" type="submit" disabled={pending}>Finish workout</button></div>
      </form>

      {sheet ? (
        <PickSheet
          mode={sheet.mode}
          title={sheet.mode === "swap" ? `Swap ${sheet.ex?.name}` : "Add exercise"}
          options={suggestions(sheet.mode, sheet.ex ?? null, exs, candidates)}
          units={units}
          pending={pending}
          onClose={() => setSheet(null)}
          onApply={applySheet}
        />
      ) : null}
    </main>
  );
}

/** Swap: lifts that work the same main muscles first. Add: lifts you've done before. Never ones already in the session. */
function suggestions(mode: "swap" | "add", ex: SEx | null, exs: SEx[], candidates: Candidate[]): Candidate[] {
  const inSession = new Set(exs.map((e) => e.name.toLowerCase()));
  const pool = candidates.filter((c) => !inSession.has(c.name.toLowerCase()));
  const recent = (c: Candidate) => c.last?.date ?? "";
  if (mode === "swap" && ex) {
    const g = GUIDES[ex.subFor ?? ex.name] ?? GUIDES[ex.name];
    const main = new Set((g?.primary ?? []).map((m) => m.toLowerCase()));
    const all = new Set([...main, ...(g?.secondary ?? []).map((m) => m.toLowerCase())]);
    const score = (c: Candidate) => {
      const o = GUIDES[c.name];
      if (!o) return 0;
      return o.primary.reduce((s, m) => s + (main.has(m.toLowerCase()) ? 3 : all.has(m.toLowerCase()) ? 1 : 0), 0)
        + o.secondary.reduce((s, m) => s + (main.has(m.toLowerCase()) ? 1 : 0), 0);
    };
    const ranked = pool.map((c) => ({ c, s: score(c) })).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || (recent(b.c) > recent(a.c) ? 1 : -1)).map((x) => x.c);
    const fill = pool.filter((c) => !ranked.includes(c) && /Kettlebell|Farmer|Goblet|Turkish/.test(c.name));
    return [...ranked, ...fill].slice(0, 7);
  }
  const done = pool.filter((c) => c.last).sort((a, b) => (recent(b) > recent(a) ? 1 : -1));
  const rest = pool.filter((c) => !c.last && GUIDES[c.name]);
  return [...done, ...rest].slice(0, 8);
}

function PickSheet({ mode, title, options, units, pending, onClose, onApply }: {
  mode: "swap" | "add"; title: string; options: Candidate[]; units: Units; pending: boolean;
  onClose: () => void; onApply: (names: string[]) => void;
}) {
  const [picks, setPicks] = useState<string[]>([]);
  const [own, setOwn] = useState("");
  const names = [...picks, ...(own.trim() ? [own.trim()] : [])];
  const n = names.length;
  const lastLine = (c: Candidate) => c.last
    ? `last ${c.last.top != null ? `${w(c.last.top, units)} ${unit(units)} × ` : ""}${c.last.sets.map((s) => s.reps ?? "?").join(", ")} · ${fmtShort(c.last.date)}`
    : "new";
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="cap">{mode === "swap" ? "Pick one or more. Next time this day comes up, your swap is kept." : "Added lifts are kept for next time too."}</p>
      {options.length ? (
        <div className="card flat clip">
          {options.map((o) => {
            const on = picks.includes(o.name);
            return (
              <button key={o.name} type="button" className="row" aria-pressed={on}
                onClick={() => setPicks(on ? picks.filter((x) => x !== o.name) : [...picks, o.name])}
                style={{ ...rowBtn, background: on ? "var(--tint-ember-soft)" : "transparent" }}>
                <Ring on={on} />
                <span style={{ flexGrow: 1, minWidth: 0 }}>
                  <span className="ln" style={{ display: "block" }}>{o.name}</span>
                  <span className="cap">{lastLine(o)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <form onSubmit={(e) => { e.preventDefault(); onApply(names); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "block" }}><span className="flab">Or type your own</span>
          <input className="fld" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Exercise name" autoComplete="off" />
        </label>
        <button type="submit" className="btn" disabled={pending || !n}>
          {pending ? "Saving…" : mode === "swap" ? (n ? `Swap in ${n}` : "Swap") : (n ? `Add ${n}` : "Add")}
        </button>
      </form>
    </Sheet>
  );
}

function FinisherCard({ fin, finishers, onChange, onClose, onSkip }: {
  fin: Fin; finishers: Fin[]; onChange: (f: Fin | null, now?: boolean) => void; onClose: () => void; onSkip: () => void;
}) {
  const setMove = (i: number, patch: Partial<FinisherMove>, now = false) =>
    onChange({ ...fin, moves: fin.moves.map((m, j) => (j === i ? { ...m, ...patch } : m)) }, now);
  const grid = "minmax(0,1.6fr) minmax(0,1fr) 44px";
  return (
    <div className="card" style={{ padding: 16, border: "2px solid var(--ember)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div><p className="lab" style={{ color: "var(--rust)" }}>Ab finisher</p><h2 className="disp" style={{ fontSize: 22, marginTop: 2 }}>{fin.name}</h2></div>
        <button type="button" onClick={onClose} style={{ ...linkBtn, fontSize: 13, flexShrink: 0 }}>Close</button>
      </div>
      <div className="chips" style={{ marginRight: -16, paddingRight: 16 }}>
        {finishers.map((o) => (
          <button key={o.name} type="button" className={`chip${o.name === fin.name ? " on" : ""}`} style={{ minHeight: 36, padding: "0 12px" }}
            onClick={() => onChange({ name: o.name, moves: o.moves.map((m) => ({ ...m, done: false })) }, true)}>
            {o.name}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: 8 }}>
        <span className="lab" style={{ fontSize: 10 }}>Move</span>
        <span className="lab" style={{ fontSize: 10, textAlign: "center" }}>Reps / time</span>
        <span />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: -6 }}>
        {fin.moves.map((m, i) => {
          const f: CSSProperties = { width: "100%", height: 44, borderRadius: 10, border: "1px solid var(--line-strong)", background: m.done ? "#fff" : "var(--field)", color: m.done ? "var(--muted)" : "var(--navy)" };
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: grid, gap: 8, alignItems: "center" }}>
              <label><span className="sr-only">Move {i + 1}</span>
                <input value={m.name} placeholder="Move" onChange={(e) => setMove(i, { name: e.target.value })} style={{ ...f, padding: "0 10px", fontSize: 14, fontWeight: 600 }} />
              </label>
              <label><span className="sr-only">Reps or time for {m.name || `move ${i + 1}`}</span>
                <input value={m.dose} placeholder="20" onChange={(e) => setMove(i, { dose: e.target.value })} style={{ ...f, textAlign: "center", fontSize: 15, fontWeight: 700 }} />
              </label>
              <button type="button" className={`chk${m.done ? " on" : ""}`} aria-pressed={!!m.done} aria-label={`${m.name || "Move"} done`} onClick={() => setMove(i, { done: !m.done }, true)}>
                {m.done ? <IconCheck size={18} /> : null}
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
        <button type="button" className="btn2" onClick={() => onChange({ ...fin, moves: [...fin.moves, { name: "", dose: "", done: false }] }, true)}>+ Add move</button>
        <button type="button" className="btn2" style={{ color: "var(--rust)" }} onClick={onSkip}>Skip today</button>
      </div>
    </div>
  );
}

function summary(e: SEx, units: Units) {
  const done = e.sets.filter((s) => s.done);
  const ws = [...new Set(done.map((s) => (s.weight_kg == null ? null : w(s.weight_kg, units))).filter(Boolean))];
  const reps = done.map((s) => s.reps ?? "?").join(", ");
  return ws.length ? `${ws.join(" · ")} ${unit(units)} · ${reps}` : `${reps} reps`;
}

function ExerciseCard({ ex, units, sessionId, onSwap, onPatch, onAddSet }: {
  ex: SEx; units: Units; sessionId: string;
  onSwap: () => void;
  onPatch: (exId: string, setId: string, patch: Partial<SSet>) => void;
  onAddSet: (s: SSet) => void;
}) {
  const [vals, setVals] = useState<Record<string, { w: string; r: string }>>(() =>
    Object.fromEntries(ex.sets.map((s) => [s.id, { w: s.weight_kg == null ? "" : w(s.weight_kg, units), r: s.reps == null ? "" : String(s.reps) }])),
  );
  const [, start] = useTransition();
  const current = ex.sets.find((s) => !s.done)?.id;
  const logged = ex.sets.some((s) => s.done);

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
      <h2 className="disp" style={{ fontSize: 22 }}>{ex.name}</h2>
      <p className="cap" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "baseline", marginTop: 2 }}>
        {ex.plan}
        {logged ? null : <button type="button" onClick={onSwap} style={linkBtn}>Swap</button>}
        <Link href={`/train/library/${ex.exerciseId}?from=${sessionId}`} style={{ fontWeight: 600 }}>How to</Link>
      </p>
      {ex.subFor ? <p style={{ marginTop: 6 }}><span className="tag ember">Swapped in for {ex.subFor}</span></p> : null}
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
          const active = s.id === current;
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) minmax(0,1fr) 44px", gap: 8, alignItems: "center" }}>
              <span className="num" style={{ color: active ? "var(--rust)" : "var(--muted)" }}>{s.set_no}</span>
              <label><span className="sr-only">Set {s.set_no} weight in {unit(units)}</span>
                <input inputMode="decimal" value={v.w} placeholder={ph.w} style={fld(active, s.done)}
                  onChange={(e) => setVals({ ...vals, [s.id]: { ...v, w: e.target.value.replace(",", ".") } })} />
              </label>
              <label><span className="sr-only">Set {s.set_no} reps</span>
                <input inputMode="numeric" value={v.r} placeholder={ph.r} style={fld(active, s.done)}
                  onChange={(e) => setVals({ ...vals, [s.id]: { ...v, r: e.target.value.replace(/\D/g, "") } })} />
              </label>
              <button type="button" className={`chk${s.done ? " on" : ""}`} aria-pressed={s.done} aria-label={`Set ${s.set_no} done`} onClick={() => toggle(s)}>
                {s.done ? <IconCheck size={18} /> : null}
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn2" style={{ marginTop: 12, width: "100%" }}
        onClick={() => start(async () => { const s = await addSet(ex.id); onAddSet({ ...s, weight_kg: null, reps: null, done: false }); setVals((p) => ({ ...p, [s.id]: { w: "", r: "" } })); })}>
        + Add set
      </button>
    </div>
  );
}
