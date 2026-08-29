import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DailyLogForm from "./daily-log-form";

export default async function DailyLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <h1 className="mb-1 text-xl font-bold">Daily Log</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Record today&apos;s study progress.
      </p>
      <DailyLogForm userId={user.id} />
    </main>
  );
}
