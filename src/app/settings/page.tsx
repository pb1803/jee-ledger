import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { GoalForm } from "./goal-form";
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

  const { data: goals } = await supabase
    .from("goals")
    .select("id, metric, target_value")
    .eq("student_id", user.id)
    .eq("frequency", "DAILY");

  const initialGoals = (goals ?? [])
    .filter(
      (g) => g.metric === "QUESTIONS_SOLVED" || g.metric === "STUDY_MINUTES",
    )
    .map((g) => ({
      id: g.id as string,
      metric: g.metric as "QUESTIONS_SOLVED" | "STUDY_MINUTES",
      target_value: g.target_value as number,
    }));

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <h1 className="mb-4 text-xl font-bold">Settings</h1>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">Profile</h2>
        <ProfileForm initial={profile as ProfileRow | null} />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500">Daily Goals</h2>
        <GoalForm userId={user.id} initialGoals={initialGoals} />
      </section>
    </main>
  );
}
