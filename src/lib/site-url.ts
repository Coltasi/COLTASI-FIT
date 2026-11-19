import { headers } from "next/headers";

const TRUSTED: (string | RegExp)[] = ["www.coltasi.com", "coltasi.com", /^localhost(:\d+)?$/, /^coltasi-fit[a-z0-9-]*\.vercel\.app$/];

/** The address the app is being used from (e.g. https://www.coltasi.com), for links in auth emails. */
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  // Only build email links for our own addresses. A forged Host header must never be able to
  // point a password-reset link at someone else's site.
  if (host && TRUSTED.some((t) => (typeof t === "string" ? host === t : t.test(host)))) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.coltasi.com";
}
