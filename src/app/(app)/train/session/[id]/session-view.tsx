"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconPlus, IconPen } from "@/components/icons";
import { Ring, Sheet, linkBtn } from "@/components/sheet";
import { toKg, unit, w, type Units } from "@/lib/units";
import { fmtShort } from "@/lib/dates";
import { GUIDES } from "@/lib/exercise-guides";
import type { Candidate, LastTime } from "@/lib/data";
import { exerciseKey } from "@/lib/exercise-match";
import { lastLine, searchCandidates } from "@/components/exercise-search";
import { addLifts, addOwed, addSet, cancelEdit, dropOwed, finishSession, moveExerciseAfter, saveSet, saveSetEffort, setExtra, setWarmup, skipLift, swapLift } from "../../actions";
import { CheckInCard } from "./check-in-card";
import { GRIND_CUE, SET_EFFORTS, SET_EFFORT_LABEL, isHardSet, type SetEffort } from "@/lib/set-effort";
import { FINISHER_CUE, PRIMER_CUE, balanceRoles, type Role } from "@/lib/placement";
import { SKIP_LABEL, owedLine, type Owed, type SkipReason } from "@/lib/owed";

export type SSet = { id: string; set_no: number; weight_kg: number | null; reps: number | null; done: boolean; effort?: SetEffort | null };
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
const actBtn: CSSProperties = { flex: 1, height: 48, fontSize: 16, borderRadius: 12, textDecoration: "none" };
const rowBtn: CSSProperties = { width: "100%", background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, textAlign: "left", cursor: "pointer" };

function Dot({ done, dashed }: { done: boolean; dashed?: boolean }) {
  return done ? (
    <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--navy)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconCheck size={14} /></span>
  ) : (
    <span style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px ${dashed ? "dashed" : "solid"} var(--check-line)`, flexShrink: 0 }} />
  );
}

function Row({ done, dashed, name, sub, muted, tag, onClick }: { done: boolean; dashed?: boolean; name: string; sub?: string; muted?: boolean; tag?: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="row" onClick={onClick} style={rowBtn}>
      <Dot done={done} dashed={dashed} />
      <div style={{ flexGrow: 1 }}>
        <p className="ln" style={{ color: muted ? "var(--muted)" : "var(--navy)" }}>{name}</p>
        {sub ? <p className="cap">{sub}</p> : null}
        {tag ? <div style={{ marginTop: 6 }}>{tag}</div> : null}
      </div>
    </button>
  );
}

/** The Coach's call on an upcoming lift, as a visible tag with the bird. */
function CoachTag({ call }: { call: CoachCall }) {
  return (
    <span className={`tag ${call.tone === "up" ? "jade" : "ember"}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/coltasi-bird.svg" alt="" width={16} height={16} />Coach: {call.text}
    </span>
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
      <button type="button" onClick={onChange} style={{ ...linkBtn, fontSize: 14, flexShrink: 0 }}>{warmup ? "Change" : "Choose"}</button>
    </div>
  );
}

export function SessionView({ session, exercises: initial, candidates, owed: initialOwed, initialOpen, units, checkIn }: {
  session: Session; exercises: SEx[]; candidates: Candidate[]; owed: Owed[]; initialOpen: string | null; units: Units;
  checkIn?: { feel: string | null; pains: string[]; notes: string | null; effort?: string | null };
}) {
  const editing = !!session.editing;
  const router = useRouter();
  const [exs, setExs] = useState(initial);
  const [extras, setExtras] = useState({ warmup_done: session.warmup_done, finisher_done: session.finisher_done, cooldown_done: session.cooldown_done });
  const [warmup, setWarm] = useState<string | null>(session.warmup);
  const [warmSheet, setWarmSheet] = useState(false);
  const [openId, setOpenId] = useState<string | null>(() =>
    (initialOpen && initial.some((e) => e.id === initialOpen) ? initialOpen : null) ?? initial.find((e) => !isDone(e))?.id ?? null);
  const [rampTicks, setRampTicks] = useState<boolean[]>([false, false, false]);
  const [owed, setOwed] = useState(initialOwed);
  const [skipFor, setSkipFor] = useState<SEx | null>(null);
  const [sheet, setSheet] = useState<{ mode: "swap" | "add"; ex?: SEx } | null>(() => (session.kind === "custom" && !initial.length ? { mode: "add" } : null));
  const [pending, start] = useTransition();
  // Set ticks save without refreshing other screens (keeps logging fast), so when you leave the
  // workout, drop the remembered tabs and show Today/History with the new sets.
  useEffect(() => () => router.refresh(), [router]);
  // Balance work vs heavy lifts: primers before (no rating), loaded Bosu after (finisher).
  const { roles, lastHeavyId } = balanceRoles(exs.map((e) => ({
    id: e.id, name: e.name, skipped: e.skipped,
    heaviestKg: Math.max(0, ...e.sets.filter((z) => z.done).map((z) => z.weight_kg ?? 0), e.last?.top ?? 0) || null,
  })));
  const lastHeavyName = exs.find((e) => e.id === lastHeavyId)?.name ?? null;
  const rated = (e: SEx) => !e.skill && roles.get(e.id) !== "primer";
  const doneCount = exs.filter(isDone).length;
  const skippedCount = exs.filter((e) => e.skipped).length;
  const hardCount = exs.filter(rated).reduce((n, e) => n + e.sets.filter((z) => z.done && isHardSet(z.effort)).length, 0);

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
      // Working sets ask how hard they were, so move on once the last one is rated, not the moment it's ticked.
      const finished = ex && isDone(ex) && (!rated(ex) ? patch.done : patch.effort != null && ex.sets.every((z) => z.effort));
      if (finished) setOpenId(next.find((e) => !isDone(e))?.id ?? null);
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

  // Ramp-up sets are their own entry, right before the first weighted lift of the day (not logged, not counted).
  const rampEx = editing ? null : rampLift(exs);
  const rampLogged = !!rampEx && rampEx.sets.some((s) => s.done);
  const ramp = rampEx ? rampRows(rampEx, units) : [];
  type Item = { kind: "ramp"; id: string; ex: SEx; i: number } | { kind: "ex"; id: string; ex: SEx };
  const items: Item[] = exs.flatMap((e): Item[] => (rampEx && e.id === rampEx.id
    ? [...ramp.map((_, i): Item => ({ kind: "ramp", id: `${RAMP}${i}`, ex: e, i })), { kind: "ex", id: e.id, ex: e }]
    : [{ kind: "ex", id: e.id, ex: e }]));

  const tickRamp = (i: number) => setRampTicks((t) => t.map((v, j) => (j === i ? !v : v)));

  // Plan order: rows before the open entry (warm-up first), the open entry, rows after it.
  const openPos = items.findIndex((it) => it.id === openId);
  const cut = openPos < 0 ? items.length : openPos;
  const open = openPos < 0 ? null : items[openPos];
  const itemRow = (it: Item) => {
    if (it.kind === "ex") return exRow(it.ex);
    const on = rampTicks[it.i] || rampLogged;
    return <Row key={it.id} done={on} muted={on} dashed name={`Ramp-up · ${ramp[it.i]}`} onClick={() => tickRamp(it.i)} />;
  };
  const exRow = (e: SEx) => e.skipped
    ? <Row key={e.id} done={false} dashed muted name={e.name} sub={e.skill ? "Skipped · tap to undo" : `Skipped · ${SKIP_LABEL[e.skipped]} · Coach will remind you · tap to undo`} onClick={() => skip(e, null)} />
    : isDone(e)
    ? (() => { const sm = summary(e, units); return (
        <Row key={e.id} done muted name={e.name} sub={sm.text} onClick={() => setOpenId(e.id)}
          tag={sm.beat ? <span className="tag jade">↑ Beat last time</span> : undefined} />
      ); })()
    : <Row key={e.id} done={false} name={e.name} onClick={() => setOpenId(e.id)}
        tag={roles.get(e.id) === "misplaced" ? <span className="tag ember">Move after your heavy lifts</span> : e.coach ? <CoachTag call={e.coach} /> : undefined}
        sub={`${e.plan}${e.last?.top != null ? ` · last ${w(e.last.top, units)} ${unit(units)}` : ""}${e.subFor ? ` · for ${e.subFor}` : ""}`} />;

  const top: ReactNode[] = [
    <WarmupRow key="warmup" warmup={warmup} done={extras.warmup_done}
      onToggle={() => (warmup ? toggleExtra("warmup_done") : setWarmSheet(true))} onChange={() => setWarmSheet(true)} />,
  ];
  items.slice(0, cut).forEach((it) => top.push(itemRow(it)));

  const bottom: ReactNode[] = items.slice(openPos < 0 ? items.length : openPos + 1).map(itemRow);
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
        <Link prefetch={false} href={`/train/session/${session.id}/edit`} className="btn2" style={{ marginTop: 6 }}>Edit</Link>
      </div>

      {editing ? (
        <div style={{ background: "var(--tint-ember)", border: "1.5px solid var(--ember)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", color: "var(--rust)" }}>
          <IconPen size={18} />
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Editing a finished workout. Changes save to the original date.</p>
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
              <button type="button" disabled={pending} onClick={() => leaveOwed(o)} style={{ ...linkBtn, fontSize: 14, flexShrink: 0 }}>Drop</button>
            </div>
          ))}
          <p className="cap" style={{ fontSize: 14 }}>Added for today only. It won&apos;t change this day&apos;s plan.</p>
        </div>
      ) : null}

      {top.length ? <div className="card clip">{top}</div> : null}

      {open?.kind === "ex" ? (
        <ExerciseCard key={open.id} ex={open.ex} units={units} sessionId={session.id}
          role={roles.get(open.ex.id) ?? null} lastHeavyName={lastHeavyName}
          onMoveAfter={lastHeavyId ? () => start(async () => {
            await moveExerciseAfter(session.id, open.ex.id, lastHeavyId);
            setOpenId(exs.find((e) => !isDone(e) && e.id !== open.ex.id)?.id ?? null);
            router.refresh();
          }) : undefined}
          onSwap={() => setSheet({ mode: "swap", ex: open.ex })}
          onSkip={() => (open.ex.skill ? skip(open.ex, "time") : setSkipFor(open.ex))}
          onPatch={patchSet}
          onAddSet={(s) => setExs((prev) => prev.map((e) => (e.id === open.ex.id ? { ...e, sets: [...e.sets, s] } : e)))} />
      ) : null}

      {exs.some((e) => !e.skill) ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--navy)", color: "#fff", borderRadius: 18, padding: "16px 20px" }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Hard sets today</span>
          <span className="disp" style={{ fontSize: 28, color: "#fff" }}>{hardCount}</span>
        </div>
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

/** One plain line for a finished lift: its top set, not a row of numbers. Plus whether it beat last time's top set. */
function summary(e: SEx, units: Units): { text: string; beat: boolean } {
  const done = e.sets.filter((s) => s.done);
  const n = `${done.length} ${done.length === 1 ? "set" : "sets"}`;
  if (e.skill) return { text: `${n} · best hold ${Math.max(0, ...done.map((s) => s.reps ?? 0))} s`, beat: false };
  const loaded = done.filter((s) => (s.weight_kg ?? 0) > 0);
  if (!loaded.length) return { text: `${n} · best ${Math.max(0, ...done.map((s) => s.reps ?? 0))} reps`, beat: false };
  const top = loaded.reduce((a, s) => ((s.weight_kg ?? 0) > (a.weight_kg ?? 0) || ((s.weight_kg ?? 0) === (a.weight_kg ?? 0) && (s.reps ?? 0) > (a.reps ?? 0)) ? s : a));
  const lastTop = e.last?.top ?? null;
  const lastTopReps = lastTop != null ? Math.max(0, ...(e.last?.sets ?? []).filter((z) => z.weight_kg === lastTop).map((z) => z.reps ?? 0)) : 0;
  const beat = lastTop != null && ((top.weight_kg ?? 0) > lastTop + 0.01 || (Math.abs((top.weight_kg ?? 0) - lastTop) < 0.01 && (top.reps ?? 0) > lastTopReps));
  return { text: `${n} · top set ${w(top.weight_kg!, units)} ${unit(units)} × ${top.reps ?? "?"}`, beat };
}

/** Colours for a rated set: Easy stays quiet, Hard is terracotta, Failed is navy. */
const EFFORT_BG: Record<SetEffort, string> = { easy: "var(--tint-neutral)", hard: "var(--rust)", failed: "var(--navy)" };
const EFFORT_FG: Record<SetEffort, string> = { easy: "var(--navy)", hard: "#fff", failed: "#fff" };

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

const RAMP = "__ramp";
const rampKg = (ex: SEx) => ex.coach?.kg ?? ex.last?.sets[0]?.weight_kg ?? ex.last?.top ?? null;

/** The lift that gets ramp-up sets: first weighted lift still to do (skips skill blocks, skipped lifts, bells and bodyweight). */
function rampLift(exs: SEx[]): SEx | null {
  const ex = exs.find((e) => !e.skill && !e.skipped && !isBellLift(e.name));
  if (!ex || (ex.last && rampKg(ex) == null)) return null;
  return ex;
}

/** Ramp-up sets as tick rows, e.g. "20 kg × 8–10". Light weight, nothing saved. */
function rampRows(ex: SEx, units: Units): string[] {
  const kg = rampKg(ex);
  if (kg == null) return ["light × 8–10", "medium × 5", "heavier × 2–3"];
  return rampSets(kg, units).map((r) => `${r.w} ${unit(units)} × ${r.reps}`);
}

function ExerciseCard({ ex, units, sessionId, role, lastHeavyName, onMoveAfter, onSwap, onSkip, onPatch, onAddSet }: {
  ex: SEx; units: Units; sessionId: string;
  /** Balance work's place in today's order (Bosu, Turkish Get-Up). */
  role: Role; lastHeavyName: string | null; onMoveAfter?: () => void;
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
  /** The set whose "How hard was that?" buttons are showing. */
  const [askFor, setAskFor] = useState<string | null>(null);
  const current = ex.sets.find((s) => !s.done)?.id;
  /** Primers (and skill blocks) aren't meant to be hard, so they don't ask. */
  const rates = !ex.skill && role !== "primer";
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
    onPatch(ex.id, s.id, { done, weight_kg: kg, reps, ...(done ? {} : { effort: null }) });
    setAskFor(done && rates ? s.id : null);
    start(() => saveSet(s.id, kg, reps, done));
  }

  function rate(s: SSet, effort: SetEffort) {
    setAskFor(null);
    onPatch(ex.id, s.id, { effort });
    start(() => saveSetEffort(s.id, effort));
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
      <p className="cap" style={{ marginTop: 2 }}>{ex.plan}</p>
      {role === "misplaced" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, background: "var(--tint-ember)", border: "1.5px solid var(--ember)", borderRadius: 14, padding: "12px 14px" }}>
          <p style={{ fontSize: 17, fontWeight: 600, color: "var(--rust)", margin: 0 }}>
            Loaded Bosu work tires the stabilisers your heavy lifts need. Do it after {lastHeavyName ?? "your heavy lifts"}.
          </p>
          {onMoveAfter ? <button type="button" className="btn2" onClick={onMoveAfter} style={{ height: 48, fontSize: 16 }}>Move after {lastHeavyName}</button> : null}
        </div>
      ) : ex.skill ? null : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, borderRadius: 14, padding: "12px 14px",
          background: role === "primer" ? "var(--tint-blue)" : "var(--tint-ember)", color: role === "primer" ? "var(--kingfisher-text)" : "var(--rust)" }}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{role === "primer" ? PRIMER_CUE : role === "finisher" ? FINISHER_CUE : GRIND_CUE}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {logged || ex.skill ? null : <button type="button" className="btn2" onClick={onSwap} style={actBtn}>Swap</button>}
        {logged ? null : <button type="button" className="btn2" onClick={onSkip} style={actBtn}>Skip</button>}
        <Link prefetch={false} href={`/train/library/${ex.exerciseId}?from=${sessionId}`} className="btn2" style={actBtn}>How to</Link>
      </div>
      {ex.skill ? <p style={{ marginTop: 6 }}><span className="tag cream">Skill · warm-up</span></p> : null}
      {ex.subFor ? <p style={{ marginTop: 6 }}><span className="tag ember">Swapped in for {ex.subFor}</span></p> : null}
      {ex.last ? (
        <p className="cap" style={{ marginTop: 4 }}>
          Last time <span style={{ color: "var(--navy)", fontWeight: 600 }}>
            {ex.last.top != null ? `${w(ex.last.top, units)} ${unit(units)} × ` : ""}{ex.last.sets.map((s) => s.reps ?? "?").join(", ")}
          </span> · {fmtShort(ex.last.date)}
        </p>
      ) : <p className="cap" style={{ marginTop: 4 }}>First time logging this one.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) minmax(0,1fr) 44px", gap: 8, alignItems: "center", margin: "14px 0 6px" }}>
        <span className="lab" style={{ fontSize: 14 }}>Set</span>
        <span className="lab" style={{ fontSize: 14, textAlign: "center" }}>{ex.skill ? "" : unit(units)}</span>
        <span className="lab" style={{ fontSize: 14, textAlign: "center" }}>{ex.skill ? "Secs held" : "Reps"}</span>
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
              {s.done && rates ? (
                askFor === s.id ? (
                  <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 10, background: "var(--field)", border: "1.5px solid var(--navy)", borderRadius: 14, padding: 12 }}>
                    <p className="ln" style={{ margin: 0 }}>How hard was set {s.set_no}?</p>
                    <div role="group" aria-label={`How hard was set ${s.set_no}`} style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                      {SET_EFFORTS.map((o) => (
                        <button key={o.id} type="button" aria-pressed={s.effort === o.id} onClick={() => rate(s, o.id)}
                          style={{ minHeight: 68, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                            background: s.effort === o.id ? EFFORT_BG[o.id] : "#fff", color: s.effort === o.id ? EFFORT_FG[o.id] : o.id === "hard" ? "var(--rust)" : "var(--navy)",
                            border: `2px solid ${o.id === "easy" ? "var(--line-strong)" : o.id === "hard" ? "var(--ember)" : "var(--navy)"}` }}>
                          <span style={{ fontSize: 17, fontWeight: 700 }}>{o.label}</span>
                          <span style={{ fontSize: 15 }}>{o.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: -2 }}>
                    <button type="button" onClick={() => setAskFor(s.id)} aria-label={s.effort ? `Set ${s.set_no} felt ${SET_EFFORT_LABEL[s.effort]}. Change` : `Rate set ${s.set_no}`}
                      style={{ minHeight: 36, borderRadius: 999, padding: "4px 14px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        background: s.effort ? EFFORT_BG[s.effort] : "#fff", color: s.effort ? EFFORT_FG[s.effort] : "var(--muted)",
                        border: s.effort ? "none" : "1.5px dashed var(--mist)" }}>
                      {s.effort ? SET_EFFORT_LABEL[s.effort] : "How hard?"}
                    </button>
                  </div>
                )
              ) : null}
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
          {units === "imperial" ? <p className="cap" style={{ marginTop: 4, fontSize: 14 }}>Bells are kg. The set saves as {unit(units)}.</p> : null}
        </div>
      ) : null}
      <button type="button" className="btn2" style={{ marginTop: 12, width: "100%" }}
        onClick={() => start(async () => { const s = await addSet(ex.id); onAddSet({ ...s, weight_kg: null, reps: null, done: false }); setVals((p) => ({ ...p, [s.id]: { w: "", r: "" } })); })}>
        + Add set
      </button>
    </div>
  );
}
