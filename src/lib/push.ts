/** Public VAPID key for web push. Public by design; the private half lives in Supabase Vault. */
export const VAPID_PUBLIC_KEY = "BH_JGfnueD90XD3s2F-yhVoX_nvNUYy8GLuQVpdxkMY3RgI1EXeB2W-2PU85pFzfKlZanYd6V9fvLOgvXFn1Q9Q";

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
