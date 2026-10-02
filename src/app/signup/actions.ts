"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export type ActionState = { error: string | null };

export async function signup(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const inviteCode = String(formData.get("invite_code") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/`,
      data: {
        display_name: name,
        ...(inviteCode ? { household_invite_code: inviteCode } : {}),
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/signup/check-email");
}
