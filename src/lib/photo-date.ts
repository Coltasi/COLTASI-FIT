/**
 * The day a photo was taken, as YYYY-MM-DD, worked out in the browser before the photo is shrunk (shrinking
 * through a canvas throws the camera data away).
 *  1. The camera's own "date taken" (EXIF DateTimeOriginal), in the phone's local time.
 *  2. A date in the file name, like 20260425_095938.jpg (Samsung and most Android cameras).
 *  3. The file's last-modified time.
 * null if none of these is there.
 */
export async function photoDate(file: File): Promise<{ day: string; from: "camera" | "name" | "file" } | null> {
  const exif = await exifDate(file).catch(() => null);
  if (exif) return { day: exif, from: "camera" };
  const m = file.name.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[-_ T]?\d{2}/);
  if (m && validDay(`${m[1]}-${m[2]}-${m[3]}`)) return { day: `${m[1]}-${m[2]}-${m[3]}`, from: "name" };
  if (file.lastModified) {
    const d = new Date(file.lastModified);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (validDay(day)) return { day, from: "file" };
  }
  return null;
}

function validDay(s: string) {
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= "2000-01-01";
}

/** Reads DateTimeOriginal (or DateTime) from a JPEG's EXIF block. */
async function exifDate(file: File): Promise<string | null> {
  const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return null;
  let off = 2;
  while (off + 4 <= buf.byteLength) {
    if (buf.getUint8(off) !== 0xff) return null;
    const marker = buf.getUint8(off + 1);
    const len = buf.getUint16(off + 2);
    if (marker === 0xe1 && off + 10 <= buf.byteLength && buf.getUint32(off + 4) === 0x45786966) return readTiff(buf, off + 10);
    if (marker === 0xda) return null;
    off += 2 + len;
  }
  return null;
}

function readTiff(buf: DataView, start: number): string | null {
  const little = buf.getUint16(start) === 0x4949;
  const u16 = (o: number) => buf.getUint16(start + o, little);
  const u32 = (o: number) => buf.getUint32(start + o, little);
  const str = (o: number, n: number) => { let s = ""; for (let i = 0; i < n && start + o + i < buf.byteLength; i++) s += String.fromCharCode(buf.getUint8(start + o + i)); return s; };
  const toDay = (s: string) => { const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/); const d = m ? `${m[1]}-${m[2]}-${m[3]}` : null; return d && validDay(d) ? d : null; };
  const scan = (ifd: number, want: number[]) => {
    const out: Record<number, number> = {};
    if (start + ifd + 2 > buf.byteLength) return out;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (start + e + 12 > buf.byteLength) break;
      const tag = u16(e);
      if (want.includes(tag)) out[tag] = u32(e + 8);
    }
    return out;
  };
  const ifd0 = scan(u32(4), [0x8769, 0x0132]);
  if (ifd0[0x8769]) {
    const sub = scan(ifd0[0x8769], [0x9003, 0x9004]);
    const v = sub[0x9003] ?? sub[0x9004];
    if (v != null) { const d = toDay(str(v, 19)); if (d) return d; }
  }
  return ifd0[0x0132] != null ? toDay(str(ifd0[0x0132], 19)) : null;
}
