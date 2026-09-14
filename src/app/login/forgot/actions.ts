"use server";

import { createClient } from "@/lib/supabase/server";

export type ActionState = { sent: boolean; error: string | null };

export async function requestReset(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    return { sent: false, error: error.message };
  }

  return { sent: true, error: null };
}
