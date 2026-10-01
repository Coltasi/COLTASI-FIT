import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/data";
import { IconDown, IconLock, IconMinus, IconUp } from "@/components/icons";
import { discardSession, moveExercise, removeExercise } from "../../../actions";
import { AddExerciseRow } from "./add-row";

export default async function EditSessionPage({ params }: PageProps<"/train/session/[id]/edit">) {
  const { id } = await params;
  const { supabase } = await getContext();
  const { data: s } = await supabase
    .from("sessions")
    .select("id, title, status, session_exercises(id, position, target_sets, rep_range, exercises(name), session_sets(done))")
    .eq("id", id)
    .single();
  if (!s) notFound();
  const ses = ((s.session_exercises ?? []) as any[]).sort((a, b) => a.position - b.position);
  const { data: allEx } = await supabase.from("exercises").select("name").order("name");

  return (
    <main className="screen">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p className="lab">{s.title} · in progress</p>
          <h1 className="disp" style={{ fontSize: 28, marginTop: 2 }}>Edit lifts</h1>
        </div>
        <Link href={`/train/session/${s.id}`} className="btn small" style={{ marginTop: 6 }}>Done</Link>
      </div>
      <p className="cap">Reorder with the arrows. Logged lifts are locked so history stays intact.</p>

      <div className="card clip">
        {ses.map((x, i) => {
          const logged = (x.session_sets ?? []).some((z: any) => z.done);
          return (
            <div key={x.id} className="row" style={{ padding: "4px 4px 4px 4px", gap: 4 }}>
              {logged ? (
                <span aria-label="Logged" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mist)", flexShrink: 0 }}><IconLock /></span>
              ) : (
                <form action={removeExercise.bind(null, s.id, x.id)}>
                  <button type="submit" aria-label={`Remove ${x.exercises?.name}`} style={{ width: 44, height: 44, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--rust)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><IconMinus /></span>
                  </button>
                </form>
              )}
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <p className="ln" style={{ color: logged ? "var(--muted)" : "var(--navy)" }}>{x.exercises?.name}</p>
                <p className="cap">{logged ? "logged" : `${x.target_sets} × ${x.rep_range ?? "?"}`}</p>
              </div>
              <form action={moveExercise.bind(null, s.id, x.id, -1)}>
                <button type="submit" aria-label={`Move ${x.exercises?.name} up`} disabled={i === 0} style={{ width: 36, height: 44, border: 0, background: "transparent", color: i === 0 ? "var(--line-strong)" : "var(--stone)", cursor: "pointer" }}><IconUp /></button>
              </form>
              <form action={moveExercise.bind(null, s.id, x.id, 1)}>
                <button type="submit" aria-label={`Move ${x.exercises?.name} down`} disabled={i === ses.length - 1} style={{ width: 36, height: 44, border: 0, background: "transparent", color: i === ses.length - 1 ? "var(--line-strong)" : "var(--stone)", cursor: "pointer" }}><IconDown /></button>
              </form>
            </div>
          );
        })}
        {!ses.length ? <p className="cap" style={{ padding: 16 }}>No lifts yet.</p> : null}
      </div>

      <AddExerciseRow sessionId={s.id} names={((allEx ?? []) as any[]).map((e) => e.name)} />

      <form action={discardSession.bind(null, s.id)} style={{ marginTop: 8 }}>
        <button type="submit" className="ghost" style={{ color: "var(--rust)" }}>Discard this session</button>
      </form>
    </main>
  );
}
