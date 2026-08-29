import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.display_name ?? user.email ?? "there";

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <h1 className="text-2xl font-bold">Hi {name} 👋</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-300">
        Foundation is ready. Authentication and profile are working.
      </p>
      <p className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        Daily log, important questions, and revision arrive in later phases. Use
        the Settings tab to set your name, grade, and exam targets.
      </p>
    </main>
  );
}
