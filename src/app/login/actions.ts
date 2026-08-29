"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UnlockState = { error: string | null };

// Server-side passcode gate. The passcode and the single Supabase user
// credentials are all read from server-only env vars, so they are never
// exposed to the browser. On success we sign in the fixed Supabase user with
// the anon key, which sets the session cookie and preserves the existing
// auth.uid()-based RLS model. No service-role key is used.
export async function unlock(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const passcode = (formData.get("passcode") ?? "").toString().trim();
  const expected = process.env.JEE_APP_PASSCODE;

  if (!expected) {
    return { error: "Passcode is not configured on the server." };
  }

  if (passcode !== expected) {
    return { error: "Incorrect passcode." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.JEE_APP_USER_EMAIL ?? "",
    password: process.env.JEE_APP_USER_PASSWORD ?? "",
  });

  if (error) {
    return { error: "Account is not ready. Ask the app admin to provision it." };
  }

  redirect("/");
}
