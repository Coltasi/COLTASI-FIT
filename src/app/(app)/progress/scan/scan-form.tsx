"use client";

import { useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconDoc } from "@/components/icons";
import { CoachMark } from "@/components/ui";
import { readScan, saveScan, type FormState, type ScanValues } from "../actions";

const FIELDS = [
  { name: "weight_kg", label: "Weight", unit: "kg" },
  { name: "body_fat_pct", label: "Body fat", unit: "%" },
  { name: "fat_mass_kg", label: "Fat mass", unit: "kg" },
  { name: "muscle_mass_kg", label: "Muscle mass", unit: "kg" },
  { name: "water_pct", label: "Water", unit: "%" },
  { name: "visceral_fat", label: "Visceral fat", unit: "" },
  { name: "bmr_kcal", label: "BMR", unit: "kcal" },
] as const;

/** Shrinks a phone photo to at most 2000px on the long side as JPEG, so it uploads fast and fits the vision API's limits. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

export function ScanForm({ userId, today }: { userId: string; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveScan, { error: null });
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [filled, setFilled] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMsg(null);
    const supabase = createClient();
    const added: { path: string; url: string }[] = [];
    for (const f of Array.from(files).slice(0, 3 - photos.length)) {
      const blob = await shrink(f);
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error } = await supabase.storage.from("scan-photos").upload(path, blob, { contentType: blob.type || "image/jpeg" });
      if (!error) added.push({ path, url: URL.createObjectURL(blob) });
    }
    setPhotos((p) => [...p, ...added]);
    setUploading(false);
    if (!added.length) { setMsg({ text: "Couldn't upload the photo. Type the values in below.", err: true }); return; }

    setReading(true);
    let read: ScanValues | null = null;
    try { read = await readScan([...photos, ...added].map((p) => p.path)); } catch {}
    setReading(false);
    const got = Object.entries(read ?? {}).filter(([, v]) => v != null);
    if (!got.length) { setMsg({ text: "Couldn't read the photo. Type the values in below.", err: true }); return; }
    setVals((v) => ({ ...v, ...Object.fromEntries(got.map(([k, v]) => [k, String(v)])) }));
    setFilled(Object.fromEntries(got.map(([k]) => [k, true])));
    setMsg({ text: `Filled ${got.length} of ${FIELDS.length} fields from your photo.`, err: false });
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input type="hidden" name="scanned_on" value={today} />
      {photos.map((p) => <input key={p.path} type="hidden" name="photo_path" value={p.path} />)}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.path} src={p.url} alt="Scan printout" style={{ height: 96, width: "100%", objectFit: "cover", borderRadius: 14 }} />
        ))}
        {photos.length < 3 ? (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || reading}
            style={{ height: 96, borderRadius: 14, border: "1.5px dashed var(--mist)", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--stone)", cursor: "pointer" }}>
            {uploading ? <span className="cap">Uploading…</span> : <><span style={{ fontSize: 22, lineHeight: 1 }}>+</span><span className="cap" style={{ fontSize: 11, fontWeight: 600 }}>Add photo</span></>}
          </button>
        ) : null}
        {photos.length === 0 ? (
          <div style={{ height: 96, borderRadius: 14, background: "var(--tint-neutral)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--stone)", gridColumn: "span 2", padding: 10, textAlign: "center" }}>
            <IconDoc size={22} /><span className="cap" style={{ fontSize: 11, fontWeight: 600 }}>Pick a photo of the printout from your library. Coach reads it for you.</span>
          </div>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />

      {reading ? (
        <div className="card cream" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }} role="status">
          <CoachMark /><span style={{ fontSize: 14, fontWeight: 600 }}>Reading your printout…</span>
        </div>
      ) : null}
      {msg ? <p role="status" style={{ fontSize: 13, marginTop: -6, fontWeight: 600, color: msg.err ? "var(--rust)" : "var(--kingfisher-text)" }}>{msg.text}</p> : null}

      <div className="card clip">
        {FIELDS.map((f, i) => (
          <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 16px", minHeight: 56, borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
            <label htmlFor={`f-${f.name}`} className="ln" style={{ flexGrow: 1 }}>{f.label}</label>
            <input id={`f-${f.name}`} name={f.name} inputMode="decimal" className="num" value={vals[f.name] ?? ""}
              onChange={(e) => { const v = e.target.value.replace(",", "."); setVals((x) => ({ ...x, [f.name]: v })); setFilled((x) => ({ ...x, [f.name]: false })); }}
              style={{
                width: 86, height: 40, borderRadius: 10, textAlign: "right", padding: "0 10px", fontSize: 16, color: "var(--navy)",
                border: `1px solid ${filled[f.name] ? "var(--kingfisher)" : "transparent"}`, background: filled[f.name] ? "var(--tint-blue)" : "var(--field)",
              }} />
            <span className="cap" style={{ width: 36 }}>{f.unit}</span>
          </div>
        ))}
      </div>
      <p className="cap">Check the numbers before saving. You can edit any field.</p>
      {state.error ? <p className="err">{state.error}</p> : null}
      <div className="dock"><div><button className="btn" type="submit" disabled={pending || uploading || reading}>{pending ? "Saving…" : "Save scan"}</button></div></div>
    </form>
  );
}
