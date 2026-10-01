"use client";

import { useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconDoc, IconPen } from "@/components/icons";
import { saveScan, type FormState } from "../actions";

const FIELDS = [
  { name: "weight_kg", label: "Weight", unit: "kg" },
  { name: "body_fat_pct", label: "Body fat", unit: "%" },
  { name: "fat_mass_kg", label: "Fat mass", unit: "kg" },
  { name: "muscle_mass_kg", label: "Muscle mass", unit: "kg" },
  { name: "water_pct", label: "Water", unit: "%" },
  { name: "visceral_fat", label: "Visceral fat", unit: "" },
  { name: "bmr_kcal", label: "BMR", unit: "kcal" },
];

export function ScanForm({ userId, today }: { userId: string; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveScan, { error: null });
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const supabase = createClient();
    const added: { path: string; url: string }[] = [];
    for (const f of Array.from(files).slice(0, 3 - photos.length)) {
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from("scan-photos").upload(path, f, { contentType: f.type || "image/jpeg" });
      if (!error) added.push({ path, url: URL.createObjectURL(f) });
    }
    setPhotos((p) => [...p, ...added]);
    setUploading(false);
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
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ height: 96, borderRadius: 14, border: "1.5px dashed var(--mist)", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--stone)", cursor: "pointer" }}>
            {uploading ? <span className="cap">Uploading…</span> : <><span style={{ fontSize: 22, lineHeight: 1 }}>+</span><span className="cap" style={{ fontSize: 11, fontWeight: 600 }}>Add photo</span></>}
          </button>
        ) : null}
        {photos.length === 0 ? (
          <div style={{ height: 96, borderRadius: 14, background: "var(--tint-neutral)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--stone)", gridColumn: "span 2", padding: 10, textAlign: "center" }}>
            <IconDoc size={22} /><span className="cap" style={{ fontSize: 11, fontWeight: 600 }}>Photo of the printout, kept with the scan</span>
          </div>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <p className="cap" style={{ marginTop: -6 }}>Type the values from your printout. Reading them from the photo comes in a later update.</p>

      <div className="card clip">
        {FIELDS.map((f, i) => (
          <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 16px", minHeight: 56, borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
            <label htmlFor={`f-${f.name}`} className="ln" style={{ flexGrow: 1 }}>{f.label}</label>
            <input id={`f-${f.name}`} name={f.name} inputMode="decimal" className="num"
              style={{ width: 86, height: 40, borderRadius: 10, border: "1px solid transparent", background: "var(--field)", textAlign: "right", padding: "0 10px", fontSize: 16, color: "var(--navy)" }} />
            <span className="cap" style={{ width: 36 }}>{f.unit}</span>
            <span style={{ color: "var(--stone)", display: "flex" }}><IconPen /></span>
          </div>
        ))}
      </div>
      {state.error ? <p className="err">{state.error}</p> : null}
      <div className="dock"><div><button className="btn" type="submit" disabled={pending || uploading}>{pending ? "Saving…" : "Save scan"}</button></div></div>
    </form>
  );
}
