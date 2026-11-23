"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconPlus, IconPen } from "@/components/icons";
import { Ring, Sheet, linkBtn } from "@/components/sheet";
import { toKg, unit, w, type Units } from "@/lib/units";
import { fmtShort } from "@/lib/dates";
import { GUIDES } from "@/lib/exercise-guides";
import type { Candidate, LastTime } from "@/lib/data";
import { exerciseKey } from "@/lib/exercise-match";
import { lastLine, searchCandidates } from "@/components/exercise-search";
import { addLifts, addOwed, addSet, cancelEdit, dropOwed, finishSession, saveSet, setExtra, setWarmup, skipLift, swapLift } from "../../actions";
import { CheckInCard } from "./check-in-card";
import { SKIP_LABEL, owedLine, type Owed, type SkipReason } from "@/lib/owed";

export type SSet = { id: string; set_no: number; weight_kg: number | null; reps: number | null; done: boolean };
/** Coach's change for this lift next time (from the latest Coach read), shown as a tag and prefilled on set 1. */
export type CoachCall = { tone: "up" | "down"; text: string; kg: number | null };
export type SEx = {
  id: string; exerciseId: string; name: string; plan: string; subFor: string | null; last: LastTime | null; coach?: CoachCall | null; sets: SSet[];
  /** Skipped today, and why. Counts as handled for progress, logs nothing. */
  skipped: SkipReason | null;
  /** Old warm-up skill block (crow pose, now retired): reps are seconds held, no weight. Kept so past sessions still read right. */
  skill: boolean;
};
type Session = {
  id: string; kind: string; title: string;
  warmup: string | null; warmup_done: boolean; cooldown: boolean; cooldown_done: boolean;
  finisher: boolean; finisher_done: boolean;
  /** A finished workout reopened to fix it: Save keeps its date, Cancel puts it back. */
  editing?: boolean;
};

const WARMUP_LABEL: Record<string, string> = { stairs: "Stairs", elliptical: "Elliptical", treadmill: "Treadmill", rower: "Rower" };
const WARMUP_KEYS = Object.keys(WARMUP_LABEL);
const isDone = (e: SEx) => !!e.skipped || (e.sets.length > 0 && e.sets.every((s) => s.done));
const SKIP_REASONS: SkipReason[] = ["sore", "equipment", "time"];
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

/** Warm-up: tap the row to tick it off, tap Change to pick (or switch) the machine at any point in the workout. */
function WarmupRow({ warmup, done, onToggle, onChange }: { warmup: string | null; done: boolean; onToggle: () => void; onChange: () => void }) {
  return (
    <div className="row">
      <button type="button" onClick={onToggle} aria-label="Warm-up done" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", display: "flex" }}>
        <Dot done={done} />
      </button>
      <button type="button" onClick={onToggle} style={{ flexGrow: 1, background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}>
        <p className="ln" style={{ color: done ? "var(--muted)" : "var(--navy)" }}>{warmup ? `Warm-up · ${WARMUP_LABEL[warmup] ?? warmup}` : "Warm-up"}</p>
        <p className="cap">{warmup ? "10 min" : "10 min · pick a machine"}</p>
      </button>
      <button type="button" onClick={onChange} style={{ ...linkBtn, fontSize: 13, flexShrink: 0 }}>{warmup ? "Change" : "Choose"}</button>
    </div>
  );
}

export function SessionView({ session, exercises: initial, candidates, owed: initialOwed, initialOpen, units, checkIn }: {
  session: Session; exercises: SEx[]; candidates: Candidate[]; owed: Owed[]; initialOpen: string | null; units: Units;
  checkIn?: { feel: string | null; pains: string[]; notes: string | null };
}) {
  const editing = !!session.editing;
  const router = useRouter();
  const [exs, setExs] = useState(initial);
  const [extras, setExtras] = useState({ warmup_done: session.warmup_done, finisher_done: session.finisher_done, cooldown_done: session.cooldown_done });
  const [warmup, setWarm] = useState<string | null>(session.warmup);
  const [warmSheet, setWarmSheet] = useState(false);
  const [openId, setOpenId] = useState<string | null>(() =>
    (initialOpen && initial.some((e) => e.id === initialOpen) ? initialOpen : null) ?? initial.find((e) => !isDone(e))?.id ?? null);
  const [owed, setOwed] = useState(initialOwed);
  const [skipFor, setSkipFor] = useState<SEx | null>(null);
  const [sheet, setSheet] = useState<{ mode: "swap" | "add"; ex?: SEx } | null>(() => (session.kind === "custom" && !initial.length ? { mode: "add" } : null));
  const [pending, start] = useTransition();
  const doneCount = exs.filter(isDone).length;
  const skippedCount = exs.filter((e) => e.skipped).length;

  function skip(ex: SEx, reason: SkipReason | null) {
    setSkipFor(null);
    setExs((prev) => {
      const next = prev.map((e) => (e.id === ex.id ? { ...e, skipped: reason } : e));
      if (reason) setOpenId(next.find((e) => !isDone(e))?.id ?? null);
      else setOpenId(ex.id);
      return next;
    });
    start(() => skipLift(ex.id, reason));
  }

  function takeOwed(o: Owed) {
    setOwed((p) => p.filter((x) => x.id !== o.id));
    start(async () => {
      const newId = await addOwed(session.id, o.id);
      router.replace(newId ? `/train/session/${session.id}?open=${newId}` : `/train/session/${session.id}`, { scroll: false });
      router.refresh();
    });
  }

  function leaveOwed(o: Owed) {
    setOwed((p) => p.filter((x) => x.id !== o.id));
    start(() => dropOwed(o.id));
  }
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

  // Ramp-up sets go on the first weighted lift of the day that's still to do (skips skill blocks, skipped lifts and bells).
  const rampId = exs.find((e) => !e.skill && !e.skipped && !isBellLift(e.name))?.id ?? null;

  // Plan order: rows before the open lift (warm-up first), the open lift, rows after it.
  const openPos = exs.findIndex((e) => e.id === openId);
  const cut = openPos < 0 ? exs.length : openPos;
  const open = openPos < 0 ? null : exs[openPos];
  const exRow = (e: SEx) => e.skipped
    ? <Row key={e.id} done={false} dashed muted name={e.name} sub={e.skill ? "Skipped · tap to undo" : `Skipped · ${SKIP_LABEL[e.skipped]} · Coach will remind you · tap to undo`} onClick={() => skip(e, null)} />
    : isDone(e)
    ? <Row key={e.id} done muted name={e.name} sub={summary(e, units)} onClick={() => setOpenId(e.id)} />
    : <Row key={e.id} done={false} name={e.name} onClick={() => setOpenId(e.id)}
        sub={`${e.coach ? `${e.coach.text} · ` : ""}${e.plan}${e.last?.top != null ? ` · last ${w(e.last.top, units)} ${unit(units)}` : ""}${e.subFor ? ` · for ${e.subFor}` : ""}`} />;

  const top: ReactNode[] = [
    <WarmupRow key="warmup" warmup={warmup} done={extras.warmup_done}
      onToggle={() => (warmup ? toggleExtra("warmup_done") : setWarmSheet(true))} onChange={() => setWarmSheet(true)} />,
  ];
  exs.slice(0, cut).forEach((e) => top.push(exRow(e)));

  const bottom: ReactNode[] = exs.slice(openPos < 0 ? exs.length : openPos + 1).map(exRow);
  if (session.finisher) bottom.push(
    <Row key="finisher" done={extras.finisher_done} muted={extras.finisher_done} dashed name="Ab finisher" onClick={() => toggleExtra("finisher_done")} />,
  );
  if (session.cooldown) bottom.push(
    <Row key="cooldown" done={extras.cooldown_done} muted={extras.cooldown_done} dashed name="Cool-down · 5 min" sub="Stretch and breathing" onClick={() => toggleExtra("cooldown_done")} />,
  );

  return (
    <main className="screen">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p className="lab" style={{ color: "var(--rust)" }}>{editing ? "Editing" : "In progress"} · {label}</p>
          <h1 className="disp" style={{ fontSize: 30, marginTop: 2 }}>{session.title}</h1>
          {session.kind === "custom" ? <p className="cap" style={{ marginTop: 4 }}>No plan. Build it as you go.</p> : null}
        </div>
        <Link href={`/train/session/${session.id}/edit`} className="btn2" style={{ marginTop: 6 }}>Edit</Link>
      </div>

      {editing ? (
        <div style={{ background: "var(--tint-ember)", border: "1.5px solid var(--ember)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", color: "var(--rust)" }}>
          <IconPen size={18} />
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Editing a finished workout. Changes save to the original date.</p>
        </div>
      ) : null}

      {exs.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {exs.map((e) => (
              <div key={e.id} style={{ height: 6, borderRadius: 3, flex: 1, background: e.skipped ? "var(--mist)" : isDone(e) ? "var(--navy)" : e.id === openId ? "var(--ember)" : "var(--line-strong)" }} />
            ))}
          </div>
          <p className="cap"><span className="num" style={{ color: "var(--navy)" }}>{doneCount}</span> of {exs.length} lifts done{skippedCount ? ` · ${skippedCount} skipped` : ""}</p>
        </div>
      ) : null}

      {owed.length ? (
        <div className="card cream" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="lab" style={{ color: "var(--navy)" }}>Coach · owed from earlier</p>
          {owed.map((o) => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <p className="ln">{o.name}</p>
                <p className="cap">{owedLine(o)}</p>
                {o.skips30 >= 3 ? <p className="cap" style={{ color: "var(--rust)" }}>{o.skips30} skips this month. Is it soreness, or should we swap it?</p> : null}
              </div>
              <button type="button" className="btn2" disabled={pending} onClick={() => takeOwed(o)} style={{ flexShrink: 0 }}>Add</button>
              <button type="button" disabled={pending} onClick={() => leaveOwed(o)} style={{ ...linkBtn, fontSize: 13, flexShrink: 0 }}>Drop</button>
            </div>
          ))}
          <p className="cap" style={{ fontSize: 12 }}>Added for today only. It won&apos;t change this day&apos;s plan.</p>
        </div>
      ) : null}

      {top.length ? <div className="card clip">{top}</div> : null}

      {open ? (
        <ExerciseCard key={open.id} ex={open} units={units} sessionId={session.id} ramp={open.id === rampId}
          onSwap={() => setSheet({ mode: "swap", ex: open })}
          onSkip={() => (open.skill ? skip(open, "time") : setSkipFor(open))}
          onPatch={patchSet}
          onAddSet={(s) => setExs((prev) => prev.map((e) => (e.id === open.id ? { ...e, sets: [...e.sets, s] } : e)))} />
      ) : null}

      {bottom.length ? <div className="card clip">{bottom}</div> : null}

      <button type="button" onClick={() => setSheet({ mode: "add" })} className="card flat"
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1.5px dashed var(--mist)", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%", color: "var(--navy)" }}>
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--tint-ember)", color: "var(--rust)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconPlus /></span>
        <span><span className="ln" style={{ display: "block" }}>Add exercise</span><span className="cap">{session.kind === "split" && !editing ? "Kept for next time" : "Add a lift to this session"}</span></span>
      </button>
      {session.kind === "custom" ? <p className="cap">Saves to History and Lifting Progress like any other session.</p> : null}

      <CheckInCard formId="finish-form" initial={editing ? checkIn : undefined} />

      <form id="finish-form" action={finishSession.bind(null, session.id)} className="dock">
        {editing ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ghost" type="submit" formAction={cancelEdit.bind(null, session.id)} disabled={pending} style={{ flex: 1 }}>Cancel</button>
            <button className="btn" type="submit" disabled={pending} style={{ flex: 2 }}>Save changes</button>
          </div>
        ) : (
          <div><button className="btn" type="submit" disabled={pending}>Finish workout</button></div>
        )}
      </form>

      {sheet ? (
        <PickSheet
          mode={sheet.mode}
          title={sheet.mode === "swap" ? `Swap ${sheet.ex?.name}` : "Add exercise"}
          options={suggestions(sheet.mode, sheet.ex ?? null, exs, candidates)}
          all={candidates.filter((c) => !exs.some((e) => exerciseKey(e.name) === exerciseKey(c.name)))}
          units={units}
          pending={pending}
          onClose={() => setSheet(null)}
          onApply={applySheet}
        />
      ) : null}

      {skipFor ? (
        <Sheet title={`Skip ${skipFor.name}`} onClose={() => setSkipFor(null)}>
          <p className="cap">Why? Coach will remind you to come back to it within the week.</p>
          <div className="card flat clip">
            {SKIP_REASONS.map((r) => (
              <button key={r} type="button" className="row" onClick={() => skip(skipFor, r)} style={rowBtn}>
                <span className="ln" style={{ flexGrow: 1 }}>{r === "sore" ? "Sore" : r === "equipment" ? "No equipment" : "Short on time"}</span>
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}

      {warmSheet ? (
        <Sheet title="Warm-up · 10 min" onClose={() => setWarmSheet(false)}>
          <div className="card flat clip">
            {WARMUP_KEYS.map((k) => {
              const on = warmup === k;
              return (
                <button key={k} type="button" className="row" aria-pressed={on}
                  onClick={() => { setWarm(k); setWarmSheet(false); start(() => setWarmup(session.id, k)); }}
                  style={{ ...rowBtn, background: on ? "var(--tint-ember-soft)" : "transparent" }}>
                  <Ring on={on} />
                  <span className="ln" style={{ flexGrow: 1 }}>{WARMUP_LABEL[k]}</span>
                </button>
              );
            })}
          </div>
        </Sheet>
      ) : null}
    </main>
  );
}

/** Swap: lifts that work the same main muscles first. Add: lifts you've done before. Never ones already in the session. */
function suggestions(mode: "swap" | "add", ex: SEx | null, exs: SEx[], candidates: Candidate[]): Candidate[] {
  const inSession = new Set(exs.map((e) => exerciseKey(e.name)));
  const pool = candidates.filter((c) => !inSession.has(exerciseKey(c.name)));
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

function PickSheet({ mode, title, options, all, units, pending, onClose, onApply }: {
  mode: "swap" | "add"; title: string; options: Candidate[]; all: Candidate[]; units: Units; pending: boolean;
  onClose: () => void; onApply: (names: string[]) => void;
}) {
  const [picks, setPicks] = useState<string[]>([]);
  const [own, setOwn] = useState("");
  const names = [...picks, ...(own.trim() ? [own.trim()] : [])];
  const n = names.length;
  // Typing searches the whole library (synonyms count: "kb swings" finds Kettlebell Swing).
  const q = own.trim();
  const shown = q ? searchCandidates(all, q, 8) : options;
  const noMatch = q.length > 0 && shown.length === 0;
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="cap">{mode === "swap" ? "Pick one or more. Next time this day comes up, your swap is kept." : "Added lifts are kept for next time too."}</p>
      {shown.length || picks.length ? (
        <div className="card flat clip">
          {[...picks.filter((p) => !shown.some((o) => o.name === p)).map((p) => all.find((o) => o.name === p) ?? options.find((o) => o.name === p) ?? { name: p, last: null }), ...shown].map((o) => {
            const on = picks.includes(o.name);
            return (
              <button key={o.name} type="button" className="row" aria-pressed={on}
                onClick={() => { setPicks(on ? picks.filter((x) => x !== o.name) : [...picks, o.name]); if (!on) setOwn(""); }}
                style={{ ...rowBtn, background: on ? "var(--tint-ember-soft)" : "transparent" }}>
                <Ring on={on} />
                <span style={{ flexGrow: 1, minWidth: 0 }}>
                  <span className="ln" style={{ display: "block" }}>{o.name}</span>
                  <span className="cap">{lastLine(o, units)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <form onSubmit={(e) => { e.preventDefault(); onApply(names); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "block" }}><span className="flab">Search or type your own</span>
          <input className="fld" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="e.g. KB swings" autoComplete="off" />
          {noMatch ? <span className="cap">No match. It will be added as a new exercise.</span> : null}
        </label>
        <button type="submit" className="btn" disabled={pending || !n}>
          {pending ? "Saving…" : mode === "swap" ? (n ? `Swap in ${n}` : "Swap") : (n ? `Add ${n}` : "Add")}
        </button>
      </form>
    </Sheet>
  );
}

function summary(e: SEx, units: Units) {
  const done = e.sets.filter((s) => s.done);
  const ws = [...new Set(done.map((s) => (s.weight_kg == null ? null : w(s.weight_kg, units))).filter(Boolean))];
  const reps = done.map((s) => s.reps ?? "?").join(", ");
  if (e.skill) return `${reps} s held`;
  return ws.length ? `${ws.join(" · ")} ${unit(units)} · ${reps}` : `${reps} reps`;
}

/** Bells you own (kg). Tap one to fill the current set's weight on kettlebell lifts. */
const BELLS_KG = [8, 12, 16, 20, 24, 30];
const isBellLift = (name: string) => /kettlebell|\bkb\b|goblet|swing|turkish|farmer|snatch|windmill|halo/i.test(name);

/** How a logged set compares with the same set last time: more weight wins, then more reps at the same weight. */
function beat(kg: number | null, reps: number | null, last: { weight_kg: number | null; reps: number | null } | undefined, units: Units): string | null {
  if (!last || reps == null) return null;
  const lk = last.weight_kg, lr = last.reps;
  if (kg != null && lk != null && kg > lk + 0.01) return `+${w(kg - lk, units)} ${unit(units)}`;
  const sameWeight = (kg == null && lk == null) || (kg != null && lk != null && Math.abs(kg - lk) < 0.01);
  if (sameWeight && lr != null && reps > lr) return `+${reps - lr} rep${reps - lr > 1 ? "s" : ""}`;
  return null;
}

/**
 * Ramp-up (warm-up) sets before the first lift: about 50%, 70% and 85% of the working weight, low reps.
 * Rounded to 2 kg / 5 lb steps. Not logged as working sets.
 */
function rampSets(kg: number, units: Units): { w: string; reps: string }[] {
  const step = units === "imperial" ? 5 : 2;
  const shown = Number(w(kg, units));
  return [[0.5, "8–10"], [0.7, "5"], [0.85, "2–3"]].map(([pct, reps]) => {
    const v = Math.max(step, Math.round((shown * (pct as number)) / step) * step);
    return { w: String(v), reps: reps as string };
  });
}

function RampUp({ ex, units }: { ex: SEx; units: Units }) {
  const kg = ex.coach?.kg ?? ex.last?.sets[0]?.weight_kg ?? ex.last?.top ?? null;
  if (ex.last && kg == null) return null; // bodyweight lift: nothing to ramp
  return (
    <div style={{ marginTop: 10, background: "var(--tint-ember)", borderRadius: 12, padding: "10px 12px" }}>
      <p className="lab" style={{ color: "var(--rust)", marginBottom: 4 }}>Ramp up first · not logged</p>
      {kg != null ? (
        <p className="cap" style={{ color: "var(--navy)" }}>
          {rampSets(kg, units).map((r) => `${r.w} ${unit(units)} × ${r.reps}`).join("  ·  ")}
        </p>
      ) : (
        <p className="cap" style={{ color: "var(--navy)" }}>2–3 light sets: about 50%, 70%, then 85% of your working weight, low reps.</p>
      )}
    </div>
  );
}

function ExerciseCard({ ex, units, sessionId, ramp, onSwap, onSkip, onPatch, onAddSet }: {
  ex: SEx; units: Units; sessionId: string; ramp?: boolean;
  onSwap: () => void;
  onSkip: () => void;
  onPatch: (exId: string, setId: string, patch: Partial<SSet>) => void;
  onAddSet: (s: SSet) => void;
}) {
  const [vals, setVals] = useState<Record<string, { w: string; r: string }>>(() =>
    Object.fromEntries(ex.sets.map((s) => [s.id, { w: s.weight_kg == null ? "" : w(s.weight_kg, units), r: s.reps == null ? "" : String(s.reps) }])),
  );
  const [, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const current = ex.sets.find((s) => !s.done)?.id;
  const bells = !ex.skill && isBellLift(ex.name);
  const lastFor = (s: SSet) => ex.last?.sets[s.set_no - 1];
  const logged = ex.sets.some((s) => s.done);

  const placeholder = useMemo(() => {
    return (s: SSet) => {
      const prevSet = ex.sets.filter((z) => z.set_no < s.set_no && z.done).at(-1);
      const lastSame = ex.last?.sets[s.set_no - 1] ?? ex.last?.sets.at(-1);
      const coachKg = s.set_no === 1 && ex.coach?.kg != null ? ex.coach.kg : null;
      const kg = coachKg ?? prevSet?.weight_kg ?? lastSame?.weight_kg ?? ex.last?.top ?? null;
      const reps = lastSame?.reps ?? prevSet?.reps ?? null;
      return { w: kg == null ? "" : w(kg, units), r: reps == null ? "" : String(reps) };
    };
  }, [ex.sets, ex.last, ex.coach, units]);

  function toggle(s: SSet) {
    const v = vals[s.id] ?? { w: "", r: "" };
    const ph = placeholder(s);
    const wStr = v.w || ph.w;
    const rStr = v.r || ph.r;
    const kg = wStr ? toKg(Number(wStr), units) : null;
    const reps = rStr ? Number(rStr) : null;
    const done = !s.done;
    if (done) setVals({ ...vals, [s.id]: { w: wStr, r: rStr } });
    if (done && beat(kg, reps, lastFor(s), units)) { setFlash(s.id); setTimeout(() => setFlash((f) => (f === s.id ? null : f)), 1400); }
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 className="disp" style={{ fontSize: 22 }}>{ex.name}</h2>
        {ex.coach ? <span className={`tag ${ex.coach.tone === "up" ? "blue" : "ember"}`} title="Coach's call for today">{ex.coach.text}</span> : null}
      </div>
      <p className="cap" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "baseline", marginTop: 2 }}>
        {ex.plan}
        {logged || ex.skill ? null : <button type="button" onClick={onSwap} style={linkBtn}>Swap</button>}
        {logged ? null : <button type="button" onClick={onSkip} style={linkBtn}>Skip</button>}
        <Link href={`/train/library/${ex.exerciseId}?from=${sessionId}`} style={{ fontWeight: 600 }}>How to</Link>
      </p>
      {ex.skill ? <p style={{ marginTop: 6 }}><span className="tag cream">Skill · warm-up</span></p> : null}
      {ex.subFor ? <p style={{ marginTop: 6 }}><span className="tag ember">Swapped in for {ex.subFor}</span></p> : null}
      {ex.last ? (
        <p className="cap" style={{ marginTop: 4 }}>
          Last time <span style={{ color: "var(--navy)", fontWeight: 600 }}>
            {ex.last.top != null ? `${w(ex.last.top, units)} ${unit(units)} × ` : ""}{ex.last.sets.map((s) => s.reps ?? "?").join(", ")}
          </span> · {fmtShort(ex.last.date)}
        </p>
      ) : <p className="cap" style={{ marginTop: 4 }}>First time logging this one.</p>}
      {ramp && !logged ? <RampUp ex={ex} units={units} /> : null}

      <div style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) minmax(0,1fr) 44px", gap: 8, alignItems: "center", margin: "14px 0 6px" }}>
        <span className="lab" style={{ fontSize: 10 }}>Set</span>
        <span className="lab" style={{ fontSize: 10, textAlign: "center" }}>{ex.skill ? "" : unit(units)}</span>
        <span className="lab" style={{ fontSize: 10, textAlign: "center" }}>{ex.skill ? "Secs held" : "Reps"}</span>
        <span />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ex.sets.map((s) => {
          const v = vals[s.id] ?? { w: "", r: "" };
          const ph = placeholder(s);
          const active = s.id === current;
          const won = s.done ? beat(s.weight_kg, s.reps, lastFor(s), units) : null;
          return (
            <div key={s.id} className={flash === s.id ? "beat-flash" : undefined} style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) minmax(0,1fr) 44px", gap: 8, alignItems: "center", position: "relative", borderRadius: 12 }}>
              <span className="num" style={{ color: active ? "var(--rust)" : "var(--muted)" }}>{s.set_no}</span>
              {won ? <span className="beat-badge" aria-label={`Beat last time by ${won}`}>{won}</span> : null}
              {ex.skill ? <span /> : (
                <label><span className="sr-only">Set {s.set_no} weight in {unit(units)}</span>
                  <input inputMode="decimal" value={v.w} placeholder={ph.w} style={fld(active, s.done)}
                    onChange={(e) => setVals({ ...vals, [s.id]: { ...v, w: e.target.value.replace(",", ".") } })} />
                </label>
              )}
              <label><span className="sr-only">Set {s.set_no} {ex.skill ? "seconds held" : "reps"}</span>
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
      {bells && current ? (
        <div style={{ marginTop: 12 }}>
          <p className="cap" style={{ marginBottom: 6 }}>Tap a bell for set {ex.sets.find((z) => z.id === current)?.set_no}</p>
          <div role="group" aria-label="Your kettlebells" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 6 }}>
            {BELLS_KG.map((kg) => {
              const v = vals[current] ?? { w: "", r: "" };
              const shown = w(kg, units);
              const on = (v.w || placeholder(ex.sets.find((z) => z.id === current)!).w) === shown;
              return (
                <button key={kg} type="button" aria-pressed={on}
                  onClick={() => setVals({ ...vals, [current]: { ...v, w: shown } })}
                  style={{ height: 40, borderRadius: 10, border: `1.5px solid ${on ? "var(--navy)" : "var(--line-strong)"}`, background: on ? "var(--navy)" : "#fff",
                    color: on ? "#fff" : "var(--navy)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                  {kg}
                </button>
              );
            })}
          </div>
          {units === "imperial" ? <p className="cap" style={{ marginTop: 4, fontSize: 11 }}>Bells are kg. The set saves as {unit(units)}.</p> : null}
        </div>
      ) : null}
      <button type="button" className="btn2" style={{ marginTop: 12, width: "100%" }}
        onClick={() => start(async () => { const s = await addSet(ex.id); onAddSet({ ...s, weight_kg: null, reps: null, done: false }); setVals((p) => ({ ...p, [s.id]: { w: "", r: "" } })); })}>
        + Add set
      </button>
    </div>
  );
}
