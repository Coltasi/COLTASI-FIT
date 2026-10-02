"use server";

import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export type ActionState = { sent: boolean; error: string | null };

export async function requestReset(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    return { sent: false, error: error.message };
  }

  return { sent: true, error: null };
}
