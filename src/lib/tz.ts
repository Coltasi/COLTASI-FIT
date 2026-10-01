import { cookies } from "next/headers";

/** The viewer's time zone, set by <TimezoneCookie/> on the client. */
export async function getTz(): Promise<string> {
  const c = await cookies();
  const tz = c.get("tz")?.value;
  try {
    if (tz) {
      Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    }
  } catch {}
  return "Europe/Madrid";
}
