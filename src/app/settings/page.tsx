import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import type { ProfileRow } from "@/lib/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <h1 className="mb-4 text-xl font-bold">Settings</h1>
      <ProfileForm initial={profile as ProfileRow | null} email={user.email ?? ""} />
    </main>
  );
}
