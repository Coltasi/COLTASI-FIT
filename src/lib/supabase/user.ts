import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The signed-in user from the session JWT. getClaims() verifies the token locally when the
 * project uses asymmetric signing keys, so it skips the round trip that getUser() makes.
 */
export async function currentUser(supabase: SupabaseClient): Promise<{ id: string; email: string | null } | null> {
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  return c?.sub ? { id: c.sub as string, email: (c.email as string | undefined) ?? null } : null;
}
