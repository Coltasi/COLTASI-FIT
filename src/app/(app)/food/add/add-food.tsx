"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CoachMark } from "@/components/ui";
import { IconBarcode, IconCamera } from "@/components/icons";
import { deleteSaved, estimateFood, logFood, logSaved, lookupBarcode, type Product } from "../actions";

type Saved = { id: string; name: string; kcal: number; protein_g: number };
type Draft = { name: string; kcal: string; protein: string; source: "manual" | "photo" | "text" | "barcode"; note?: string | null };

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
  const BD = (globalThis as any).BarcodeDetector;
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
  const [product, setProduct] = useState<Product | null>(null);
  const [grams, setGrams] = useState("");
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
    setBusy(`saved-${s.id}`); setErr(null);
    const r = await logSaved(s.id, day);
    setBusy(null);
    if (r.error) setErr(r.error); else done();
  }

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    setErr(null); setProduct(null); setBusy("estimate");
    try {
      const url = await shrinkToDataUrl(f);
      setPhoto(url);
      const r = await estimateFood({ photo: url, text: desc });
      if ("error" in r) { setErr(r.error); setDraft({ name: desc || "Meal", kcal: "", protein: "", source: "manual" }); }
      else setDraft({ name: r.name, kcal: String(r.kcal), protein: String(r.protein_g), source: "photo", note: r.note });
    } catch { setErr("Couldn't open that photo."); }
    setBusy(null);
  }

  async function onDescribe() {
    if (!desc.trim()) { setErr("Describe what you ate first."); return; }
    setErr(null); setProduct(null); setBusy("estimate");
    const r = await estimateFood({ photo, text: desc });
    setBusy(null);
    if ("error" in r) { setErr(r.error); setDraft({ name: desc.slice(0, 60), kcal: "", protein: "", source: "manual" }); }
    else setDraft({ name: r.name, kcal: String(r.kcal), protein: String(r.protein_g), source: photo ? "photo" : "text", note: r.note });
  }

  async function findCode(c: string) {
    if (!c) return;
    setErr(null); setDraft(null); setBusy("barcode");
    const r = await lookupBarcode(c);
    setBusy(null);
    if ("error" in r) { setErr(r.error); setDraft({ name: "", kcal: "", protein: "", source: "manual" }); return; }
    setProduct(r);
    setGrams(String(r.servingG ?? 100));
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

  function productToDraft() {
    if (!product) return;
    const g = Number(grams.replace(",", "."));
    if (!g || g <= 0 || g > 3000) { setErr("Enter how many grams you had."); return; }
    setErr(null);
    setDraft({ name: product.name, kcal: String(Math.round((product.per100.kcal * g) / 100)), protein: String(Math.round((product.per100.protein_g * g) / 10) / 10), source: "barcode", note: `${g} g` });
    setProduct(null);
  }

  async function submit() {
    if (!draft) return;
    const kcal = Number(draft.kcal.replace(",", ".")), protein = Number((draft.protein || "0").replace(",", "."));
    if (!draft.name.trim()) { setErr("Give it a name."); return; }
    if (!draft.kcal.trim() || !Number.isFinite(kcal)) { setErr("Enter the calories."); return; }
    setBusy("log"); setErr(null);
    const r = await logFood({ day, name: draft.name, kcal, protein_g: protein, source: draft.source, save: saveIt });
    setBusy(null);
    if (r.error) setErr(r.error); else done();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <p className="lab">Saved, one tap</p>
          {saved.length ? <button type="button" onClick={() => setManage((m) => !m)} style={linkBtn}>{manage ? "Done" : "Edit"}</button> : null}
        </div>
        {saved.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {saved.map((s) => (
              <button key={s.id} type="button" className="chip" disabled={!!busy} onClick={() => tapSaved(s)}
                style={manage ? { borderColor: "var(--rust)", color: "var(--rust)" } : undefined}>
                {busy === `saved-${s.id}` ? "Logging…" : manage ? `× ${s.name}` : `${s.name} · ${s.kcal}`}
              </button>
            ))}
          </div>
        ) : (
          <p className="cap" style={{ fontSize: 14 }}>Your shake and smoothie go here. Log one below and tick &ldquo;Save for one tap&rdquo;.</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
        <button type="button" className="card" disabled={!!busy} onClick={() => photoRef.current?.click()} style={tile}>
          <IconCamera /><span style={{ fontWeight: 700 }}>Photo</span><span className="cap" style={{ fontSize: 14 }}>Coach estimates it</span>
        </button>
        <button type="button" className="card" disabled={!!busy} onClick={() => codeRef.current?.click()} style={tile}>
          <IconBarcode /><span style={{ fontWeight: 700 }}>Barcode</span><span className="cap" style={{ fontSize: 14 }}>Packaged food</span>
        </button>
      </div>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={codeRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onBarcodePhoto(e.target.files?.[0]); e.target.value = ""; }} />

      <div style={{ display: "grid", gap: 8 }}>
        <label className="flab" htmlFor="desc">Or describe it</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input id="desc" className="fld" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Chicken shawarma, half the rice" style={{ flexGrow: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onDescribe(); } }} />
          <button type="button" className="btn2" disabled={!!busy} onClick={onDescribe}>Estimate</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="fld" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Barcode number" style={{ flexGrow: 1 }} />
          <button type="button" className="btn2" disabled={!!busy || !code} onClick={() => findCode(code)}>Look up</button>
        </div>
        <button type="button" onClick={() => { setErr(null); setProduct(null); setDraft({ name: "", kcal: "", protein: "", source: "manual" }); }} style={{ ...linkBtn, alignSelf: "flex-start", fontSize: 14 }}>
          Enter it yourself
        </button>
      </div>

      {busy === "estimate" || busy === "barcode" ? (
        <div className="card cream" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }} role="status">
          <CoachMark /><span style={{ fontSize: 14, fontWeight: 600 }}>{busy === "estimate" ? "Estimating…" : "Looking it up…"}</span>
        </div>
      ) : null}
      {err ? <p className="err">{err}</p> : null}

      {product ? (
        <div className="card" style={{ padding: 16, display: "grid", gap: 10, border: "2px solid var(--lagoon)" }}>
          <p style={{ fontWeight: 700 }}>{product.name}</p>
          <p className="cap" style={{ fontSize: 14 }}>{product.per100.kcal} kcal and {product.per100.protein_g} g protein per 100 g</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="flab" style={{ margin: 0 }}>How much (g)</span>
            <input className="fld" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} style={{ width: 100 }} />
          </label>
          <button type="button" className="btn" style={{ height: 46, boxShadow: "none" }} onClick={productToDraft}>Use this</button>
        </div>
      ) : null}

      {draft ? (
        <div className="card" style={{ padding: 16, display: "grid", gap: 12, border: "2px solid var(--lagoon)" }}>
          {draft.source === "photo" || draft.source === "text" ? (
            <p style={{ fontSize: 14, display: "flex", gap: 8, alignItems: "flex-start" }}><CoachMark size={18} /><span>Estimate{draft.note ? `: ${draft.note}` : ""}. Adjust if it looks off.</span></p>
          ) : null}
          <label style={{ display: "block" }}>
            <span className="flab">Name</span>
            <input className="fld" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Protein shake" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
            <label style={{ display: "block" }}>
              <span className="flab">Calories</span>
              <input className="fld" inputMode="numeric" value={draft.kcal} onChange={(e) => setDraft({ ...draft, kcal: e.target.value })} />
            </label>
            <label style={{ display: "block" }}>
              <span className="flab">Protein (g)</span>
              <input className="fld" inputMode="decimal" value={draft.protein} onChange={(e) => setDraft({ ...draft, protein: e.target.value })} />
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={saveIt} onChange={(e) => setSaveIt(e.target.checked)} style={{ width: 20, height: 20 }} />
            Save for one tap next time
          </label>
          <button type="button" className="btn" style={{ height: 50, boxShadow: "none" }} disabled={busy === "log"} onClick={submit}>
            {busy === "log" ? "Logging…" : "Log it"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const linkBtn = { background: "none", border: 0, padding: 0, color: "var(--ember-text)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" } as const;
const tile = { padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", font: "inherit", color: "var(--navy)" } as const;
