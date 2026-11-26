"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CoachMark } from "@/components/ui";
import { IconBarcode, IconGlass, IconCamera, IconPen } from "@/components/icons";
import { deleteSaved, estimateFood, logFood, logSaved, lookupBarcode } from "../actions";
import { Portion, type Draft, draftLabel, draftAmount } from "./portion";
import { macroLine, portionText, scale, type Label } from "@/lib/portion";

export type Saved = { id: string; name: string; label: Label; lastAmount: number | null };
const str = (n: number | null | undefined) => (n == null ? "" : String(n));
const blank: Draft = { name: "", kcal: "", protein: "", carbs: "", fat: "", per: "100g", packG: "", amount: "", source: "manual" };

/** Shrinks a phone photo to at most `max` px on the long side and returns a JPEG data URL. */
async function shrinkToDataUrl(file: File, max = 1024): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

/** Reads a barcode off a photo with the browser's built-in detector (Chrome on Android has it). */
async function detectBarcode(file: File): Promise<string | null> {
  const BD = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (img: ImageBitmap) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    const det = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    const codes = await det.detect(await createImageBitmap(file));
    return codes?.[0]?.rawValue ?? null;
  } catch { return null; }
}

export function AddFood({ day, back, saved }: { day: string; back: string; saved: Saved[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveIt, setSaveIt] = useState(false);
  const [code, setCode] = useState("");
  const [manage, setManage] = useState(false);
  const [, startTransition] = useTransition();
  const photoRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const done = () => { router.push(back); router.refresh(); };

  async function tapSaved(s: Saved) {
    if (manage) {
      if (!confirm(`Remove ${s.name} from saved foods?`)) return;
      startTransition(() => deleteSaved(s.id).then(() => router.refresh()));
      return;
    }
    const l = s.label;
    setErr(null); setSaveIt(false);
    setDraft({ name: s.name, kcal: str(l.kcal), protein: str(l.protein_g), carbs: str(l.carbs_g), fat: str(l.fat_g), per: l.baseG ? "100g" : "pack",
      baseG: l.baseG, packG: str(l.packG), amount: str(s.lastAmount ?? (l.baseG ?? 1)), source: "saved", savedId: s.id });
  }

  /** The + on a saved food: log the same amount as last time, in one tap. */
  async function quickSaved(s: Saved) {
    setBusy(`saved-${s.id}`); setErr(null);
    const r = await logSaved(s.id, day);
    setBusy(null);
    if (r.error) setErr(r.error); else done();
  }

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    setErr(null); setBusy("estimate");
    try {
      const url = await shrinkToDataUrl(f);
      setPhoto(url);
      const r = await estimateFood({ photo: url, text: desc });
      if ("error" in r) { setErr(r.error); setDraft({ ...blank, name: desc || "Meal", per: "pack", amount: "1" }); }
      else setDraft(fromEstimate(r, "photo"));
    } catch { setErr("Couldn't open that photo."); }
    setBusy(null);
  }

  async function onDescribe() {
    if (!desc.trim()) { setErr("Describe what you ate first."); return; }
    setErr(null); setBusy("estimate");
    const r = await estimateFood({ photo, text: desc });
    setBusy(null);
    if ("error" in r) { setErr(r.error); setDraft({ ...blank, name: desc.slice(0, 60), per: "pack", amount: "1" }); }
    else setDraft(fromEstimate(r, photo ? "photo" : "text"));
  }

  async function findCode(c: string) {
    if (!c) return;
    setErr(null); setDraft(null); setBusy("barcode");
    const r = await lookupBarcode(c);
    setBusy(null);
    if ("error" in r) { setErr(r.error); setDraft(blank); return; }
    setSaveIt(false);
    setDraft({ name: r.name, kcal: str(r.per100.kcal), protein: str(r.per100.protein_g), carbs: str(r.per100.carbs_g), fat: str(r.per100.fat_g),
      per: "100g", packG: str(r.packG), amount: str(r.servingG ?? r.packG ?? 100), source: "barcode" });
  }

  async function onBarcodePhoto(f: File | undefined) {
    if (!f) return;
    setErr(null); setBusy("barcode");
    const c = await detectBarcode(f);
    setBusy(null);
    if (!c) { setErr("Couldn't read the barcode. Type the number under it instead."); return; }
    setCode(c);
    findCode(c);
  }

  function fromEstimate(e: { name: string; kcal: number; protein_g: number; carbs_g: number | null; fat_g: number | null; note?: string | null }, source: "photo" | "text"): Draft {
    setSaveIt(false);
    return { name: e.name, kcal: str(e.kcal), protein: str(e.protein_g), carbs: str(e.carbs_g), fat: str(e.fat_g), per: "pack", packG: "", amount: "1", source, note: e.note };
  }

  async function submit() {
    if (!draft) return;
    const label = draftLabel(draft), amount = draftAmount(draft);
    if (!draft.name.trim()) { setErr("Give it a name."); return; }
    if (!label) { setErr("Enter the calories."); return; }
    if (!amount) { setErr(draft.per === "100g" ? "Enter how many grams you had." : "Pick how much you had."); return; }
    setBusy("log"); setErr(null);
    const m = scale(label, amount);
    const r = draft.savedId
      ? await logSaved(draft.savedId, day, amount)
      : await logFood({ day, name: draft.name, ...m, portion: portionText(label, amount), source: draft.source === "saved" ? "manual" : draft.source, save: saveIt ? { label, amount } : null });
    setBusy(null);
    if (r.error) setErr(r.error); else done();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 className="sec">Something new</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
        <button type="button" className="card" disabled={!!busy} onClick={() => photoRef.current?.click()} style={tile}>
          <IconCamera /><span style={{ fontWeight: 700 }}>Photo</span><span className="cap">Coach estimates</span>
        </button>
        <button type="button" className="card" disabled={!!busy} onClick={() => codeRef.current?.click()} style={tile}>
          <IconBarcode /><span style={{ fontWeight: 700 }}>Barcode</span><span className="cap">Packaged</span>
        </button>
        <Link prefetch={false} href={`/food/add/drink${day ? `?day=${day}` : ""}`} className="card" style={{ ...tile, textDecoration: "none" }}>
          <IconGlass /><span style={{ fontWeight: 700 }}>Drink</span><span className="cap">Beer, wine…</span>
        </Link>
      </div>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={codeRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onBarcodePhoto(e.target.files?.[0]); e.target.value = ""; }} />

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input id="desc" className="fld" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Describe it" placeholder="Describe it" style={{ flexGrow: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onDescribe(); } }} />
          <button type="button" className="btn2" disabled={!!busy} onClick={onDescribe} style={{ height: 50, whiteSpace: "nowrap" }}>Estimate</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="fld" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Barcode number" style={{ flexGrow: 1 }} />
          <button type="button" className="btn2" disabled={!!busy || !code} onClick={() => findCode(code)} style={{ height: 50, whiteSpace: "nowrap" }}>Look up</button>
        </div>
        <button type="button" className="btn2" disabled={!!busy} onClick={() => { setErr(null); setSaveIt(false); setDraft(blank); }} style={{ height: 50, width: "100%", gap: 8 }}>
          <IconPen size={16} />Enter it yourself
        </button>
      </div>

      <details className="card saved-foods">
        <summary style={{ listStyle: "none", padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
          <span>
            <span className="sec" style={{ display: "block" }}>Saved foods</span>
            <span className="cap">{saved.length ? `${saved.length} saved` : "None yet"}</span>
          </span>
          <svg className="chev" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ember-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div style={{ padding: "0 16px 12px", borderTop: "1px solid var(--line-soft)" }}>
          {saved.length ? (
            <div className="list">
              {saved.map((s) => {
                const m = scale(s.label, s.lastAmount ?? (s.label.baseG ?? 1));
                const amt = portionText(s.label, s.lastAmount ?? (s.label.baseG ?? 1));
                return (
                  <div key={s.id} className="li" style={{ gap: 10 }}>
                    <button type="button" disabled={!!busy} onClick={() => tapSaved(s)}
                      aria-label={manage ? `Remove ${s.name} from saved foods` : `Choose how much ${s.name}`}
                      style={{ flexGrow: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}>
                      <span style={{ flexGrow: 1, minWidth: 0 }}>
                        <span className="t" style={{ display: "block", fontSize: 16, lineHeight: 1.3 }}>{s.name}</span>
                        <span className="s" style={{ display: "block" }}>{busy === `saved-${s.id}` ? "Logging…" : `${amt ? `${amt} · ` : ""}${macroLine(m)}`}</span>
                      </span>
                      <span className="v">{m.kcal} kcal</span>
                    </button>
                    <button type="button" disabled={!!busy} onClick={() => (manage ? tapSaved(s) : quickSaved(s))}
                      aria-label={manage ? `Remove ${s.name} from saved foods` : `Log ${amt ?? "one"} ${s.name} now`}
                      style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, border: 0, cursor: "pointer",
                        background: manage ? "var(--tint-crimson)" : "var(--tint-ember)", color: manage ? "var(--crimson)" : "var(--rust)" }}>{manage ? "×" : "+"}</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="cap" style={{ paddingTop: 12 }}>Your shake and repeat foods go here. Log a food and tick &ldquo;Save for next time&rdquo;.</p>
          )}
          {saved.length ? (
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
              <button type="button" onClick={() => setManage((m) => !m)} className="pill">{manage ? "Done removing" : "Remove saved foods"}</button>
            </div>
          ) : null}
        </div>
      </details>

      {busy === "estimate" || busy === "barcode" ? (
        <div className="card cream" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }} role="status">
          <CoachMark /><span style={{ fontSize: 15, fontWeight: 600 }}>{busy === "estimate" ? "Estimating…" : "Looking it up…"}</span>
        </div>
      ) : null}
      {err ? <p className="err">{err}</p> : null}

      {draft ? (
        <Portion draft={draft} onChange={setDraft} saveIt={saveIt} onSaveIt={setSaveIt} busy={busy === "log"} onSubmit={submit} />
      ) : null}
    </div>
  );
}

const tile = { padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", font: "inherit", color: "var(--navy)" } as const;
