/** Public VAPID key for web push. Public by design; the private half lives in Supabase Vault. */
export const VAPID_PUBLIC_KEY = "BCXqsfLwJ8377igL2OenS9_CWrL_L5IxE7MvKnJB7Zje31PkJJcM9gFqpY2fUk1h6N0UCX4o7kdY1oa7-xQcEDY";

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
