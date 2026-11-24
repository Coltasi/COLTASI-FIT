"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFoods, type FoodEdit } from "./actions";

type Row = { id: string; name: string; kcal: string; protein: string; day: string; remove: boolean };

/** Food's edit mode: every entry for the day becomes editable (name, numbers, which day), or removable. Saved together. */
export function EditFoods({ items, day, today, min, exitHref }: {
  items: { id: string; name: string; kcal: number; protein_g: number }[];
  day: string; today: string; min: string; exitHref: string;
}) {
  const router = useRouter();
  const start = items.map((r) => ({ id: r.id, name: r.name, kcal: String(r.kcal), protein: String(Math.round(Number(r.protein_g) * 10) / 10), day, remove: false }));
  const [rows, setRows] = useState<Row[]>(start);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const changed = rows.filter((r, i) => JSON.stringify(r) !== JSON.stringify(start[i]));

  async function save() {
    setErr(null);
    if (!changed.length) { router.push(exitHref); return; }
    const edits: FoodEdit[] = changed.map((r) => ({ id: r.id, name: r.name, kcal: Number(r.kcal.replace(",", ".")), protein_g: Number((r.protein || "0").replace(",", ".")), day: r.day, remove: r.remove }));
    setSaving(true);
    const res = await updateFoods(edits);
    setSaving(false);
    if (res.error) { setErr(res.error); return; }
    router.push(exitHref);
    router.refresh();
  }

  if (!items.length) {
    return <p className="cap" style={{ fontSize: 14 }}>Nothing logged this day, so nothing to edit. Pick another day above.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.id} className="card" style={{ padding: 12, display: "grid", gap: 8, border: "1.5px solid var(--ember)", opacity: r.remove ? 0.55 : 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="fld" aria-label="Name" value={r.name} disabled={r.remove} onChange={(e) => set(i, { name: e.target.value })}
              style={{ flexGrow: 1, height: 40, textDecoration: r.remove ? "line-through" : undefined }} />
            <button type="button" onClick={() => set(i, { remove: !r.remove })} aria-label={r.remove ? `Keep ${r.name}` : `Remove ${r.name}`}
              style={{ height: 40, padding: "0 12px", borderRadius: 10, border: "1.5px solid var(--rust)", background: r.remove ? "var(--rust)" : "transparent", color: r.remove ? "#fff" : "var(--rust)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {r.remove ? "Undo" : "Remove"}
            </button>
          </div>
          {!r.remove ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 8 }}>
              <label><span className="flab" style={{ fontSize: 14 }}>kcal</span><input className="fld" inputMode="numeric" value={r.kcal} onChange={(e) => set(i, { kcal: e.target.value })} style={{ height: 40 }} /></label>
              <label><span className="flab" style={{ fontSize: 14 }}>Protein g</span><input className="fld" inputMode="decimal" value={r.protein} onChange={(e) => set(i, { protein: e.target.value })} style={{ height: 40 }} /></label>
              <label><span className="flab" style={{ fontSize: 14 }}>Day</span><input className="fld" type="date" min={min} max={today} value={r.day} onChange={(e) => set(i, { day: e.target.value })} style={{ height: 40, padding: "0 6px" }} /></label>
            </div>
          ) : null}
        </div>
      ))}
      {err ? <p className="err">{err}</p> : null}
      <div className="dock"><div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn2" style={{ height: 50, flex: 1 }} onClick={() => router.push(exitHref)} disabled={saving}>Cancel</button>
        <button type="button" className="btn" style={{ height: 50, flex: 2, background: "var(--ember)", boxShadow: "none" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Done"}
        </button>
      </div></div>
    </div>
  );
}
