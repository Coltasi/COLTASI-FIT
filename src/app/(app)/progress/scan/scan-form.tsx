"use client";

import { useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconDoc } from "@/components/icons";
import { CoachMark } from "@/components/ui";
import { readScan, saveScan, type FormState, type ScanValues } from "../actions";
import { photoDate } from "@/lib/photo-date";

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

const MAX = 8;

const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function ScanForm({ userId, today }: { userId: string; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveScan, { error: null });
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [filled, setFilled] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [day, setDay] = useState(today);
  const [dayNote, setDayNote] = useState<{ text: string; warn: boolean } | null>(null);
  const [photoDays, setPhotoDays] = useState<{ day: string; from: string }[]>([]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMsg(null);
    const supabase = createClient();
    const added: { path: string; url: string }[] = [];
    const dates: { day: string; from: string }[] = [];
    for (const f of Array.from(files).slice(0, MAX - photos.length)) {
      const taken = await photoDate(f); // before shrinking: the shrunk copy has no camera data
      if (taken && taken.day <= today) dates.push(taken);
      const blob = await shrink(f);
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error } = await supabase.storage.from("scan-photos").upload(path, blob, { contentType: blob.type || "image/jpeg" });
      if (!error) added.push({ path, url: URL.createObjectURL(blob) });
    }
    setPhotos((p) => [...p, ...added]);
    setUploading(false);
    const allDays = [...photoDays, ...dates];
    setPhotoDays(allDays);
    const distinct = [...new Set(allDays.map((d) => d.day))].sort();
    if (distinct.length === 1) {
      setDay(distinct[0]);
      const sure = allDays.some((d) => d.from === "camera");
      setDayNote({ text: sure ? `Photos taken ${fmtDay(distinct[0])}.` : `Date guessed from the file (${fmtDay(distinct[0])}). Check it's right.`, warn: !sure });
    } else if (distinct.length > 1) {
      setDay(distinct[distinct.length - 1]);
      setDayNote({ text: `These photos are from different days (${distinct.map(fmtDay).join(", ")}). Add one scan at a time, or set the right date below.`, warn: true });
    }
    if (!added.length) { setMsg({ text: "Couldn't upload the photo. Type the values in below.", err: true }); return; }

    setReading(true);
    let read: { values: ScanValues; problems: string[] } | null = null;
    try { read = await readScan([...photos, ...added].map((p) => p.path)); } catch {}
    setReading(false);
    setProblems(read?.problems ?? []);
    const got = Object.entries(read?.values ?? {}).filter(([, v]) => v != null);
    if (!got.length) { setMsg({ text: "Couldn't read the photo. Type the values in below.", err: true }); return; }
    setVals((v) => ({ ...v, ...Object.fromEntries(got.map(([k, v]) => [k, String(v)])) }));
    setFilled(Object.fromEntries(got.map(([k]) => [k, true])));
    const missing = FIELDS.filter((f) => !got.some(([k]) => k === f.name)).map((f) => f.label);
    setMsg({ text: `Filled ${got.length} of ${FIELDS.length} fields.${missing.length ? ` Not found: ${missing.join(", ")}. Add a photo of that screen or type it.` : ""}`, err: false });
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 16px", minHeight: 56 }}>
        <label htmlFor="f-day" className="ln" style={{ flexGrow: 1 }}>Scan date</label>
        <input id="f-day" type="date" name="scanned_on" value={day} max={today} required onChange={(e) => { setDay(e.target.value); setDayNote(null); }}
          style={{ height: 40, borderRadius: 10, padding: "0 10px", fontSize: 16, color: "var(--navy)", background: dayNote?.warn ? "var(--tint-ember)" : "var(--surface)", border: "1px solid var(--line-strong)" }} />
      </div>
      {dayNote ? <p role="status" style={{ fontSize: 15, marginTop: -8, fontWeight: 600, color: dayNote.warn ? "var(--rust)" : "var(--kingfisher-text)" }}>{dayNote.text}</p> : null}
      {photos.map((p) => <input key={p.path} type="hidden" name="photo_path" value={p.path} />)}
      {photos.length === 0 ? (
        <p className="cap" style={{ display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.45 }}>
          <IconDoc size={20} style={{ flexShrink: 0, marginTop: 1 }} />Take one photo per Tanita screen (fat, muscle, water, visceral, BMR). Coach reads the numbers and the date.
        </p>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.path} src={p.url} alt="Scan printout" style={{ height: 96, width: "100%", objectFit: "cover", borderRadius: 14 }} />
        ))}
        {photos.length < MAX ? (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || reading}
            style={{ height: 96, borderRadius: 14, border: "1.5px dashed var(--mist)", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--stone)", cursor: "pointer" }}>
            {uploading ? <span className="cap">Uploading…</span> : <><span style={{ fontSize: 22, lineHeight: 1 }}>+</span><span className="cap" style={{ fontSize: 15, fontWeight: 600 }}>Add photo</span></>}
          </button>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />

      {reading ? (
        <div className="card cream" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }} role="status">
          <CoachMark /><span style={{ fontSize: 15, fontWeight: 600 }}>Reading your scan…</span>
        </div>
      ) : null}
      {msg ? <p role="status" style={{ fontSize: 15, marginTop: -6, fontWeight: 600, color: msg.err ? "var(--rust)" : "var(--kingfisher-text)" }}>{msg.text}</p> : null}

      <div className="card clip">
        {FIELDS.map((f, i) => (
          <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 16px", minHeight: 56, borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
            <label htmlFor={`f-${f.name}`} className="ln" style={{ flexGrow: 1 }}>{f.label}</label>
            <input id={`f-${f.name}`} name={f.name} inputMode="decimal" className="num" value={vals[f.name] ?? ""}
              onChange={(e) => { setProblems([]); const v = e.target.value.replace(",", "."); setVals((x) => ({ ...x, [f.name]: v })); setFilled((x) => ({ ...x, [f.name]: false })); }}
              style={{
                width: 86, height: 40, borderRadius: 10, textAlign: "right", padding: "0 10px", fontSize: 16, color: "var(--navy)",
                border: `1px solid ${filled[f.name] ? "var(--kingfisher)" : "var(--line-strong)"}`, background: filled[f.name] ? "var(--tint-blue)" : "var(--surface)",
              }} />
            <span className="cap" style={{ width: 36 }}>{f.unit}</span>
          </div>
        ))}
      </div>
      {problems.length ? (
        <div className="card" style={{ padding: "10px 14px", background: "var(--tint-ember)", color: "var(--rust)", fontSize: 15, fontWeight: 600, display: "grid", gap: 4 }} role="alert">
          {problems.map((p) => <p key={p}>{p}</p>)}
        </div>
      ) : null}
      <p className="cap">Check the numbers before saving. You can edit any field.</p>
      {state.error ? <p className="err">{state.error}</p> : null}
      <div className="dock"><div><button className="btn" type="submit" disabled={pending || uploading || reading}>{pending ? "Saving…" : "Save scan"}</button></div></div>
    </form>
  );
}
