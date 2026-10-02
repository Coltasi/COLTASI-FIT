import { headers } from "next/headers";

/** The address the app is being used from (e.g. https://www.coltasi.com), for links in auth emails. */
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.coltasi.com";
}
