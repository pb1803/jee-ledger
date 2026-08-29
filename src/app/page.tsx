import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  emptyStats,
  overallAccuracy,
  prettySubject,
  subjectAccuracy,
  todayISO,
  totals,
  type SubjectStats,
} from "@/lib/study";
import type { Subject } from "@/lib/types";

const SUBJECTS: Subject[] = ["PHYSICS", "CHEMISTRY", "MATHEMATICS"];

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3 text-center dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const today = todayISO();
  const { data: log } = await supabase
    .from("daily_logs")
    .select("id, study_duration_minutes")
    .eq("student_id", user.id)
    .eq("log_date", today)
    .maybeSingle();

  const stats: SubjectStats = emptyStats();
  let logged = false;
  let duration = 0;

  if (log) {
    logged = true;
    duration = (log as { study_duration_minutes: number | null })
      .study_duration_minutes ?? 0;
    const { data: sds } = await supabase
      .from("subject_daily_stats")
      .select("subject, attempted, correct, incorrect")
      .eq("daily_log_id", (log as { id: string }).id);
    (sds ?? []).forEach((r) => {
      const s = (r as { subject: Subject }).subject;
      stats[s] = {
        attempted: (r as { attempted: number }).attempted ?? 0,
        correct: (r as { correct: number }).correct ?? 0,
        incorrect: (r as { incorrect: number }).incorrect ?? 0,
      };
    });
  }

  const { data: goal } = await supabase
    .from("goals")
    .select("target_value")
    .eq("student_id", user.id)
    .eq("frequency", "DAILY")
    .eq("metric", "QUESTIONS_SOLVED")
    .maybeSingle();
  const target = goal ? Number((goal as { target_value: unknown }).target_value) : null;

  const { count: revisionDue } = await supabase
    .from("important_questions")
    .select("id", { count: "exact", head: true })
    .in("revision_status", ["NOT_STARTED", "IN_PROGRESS"]);

  const t = totals(stats);
  const solved = t.attempted;
  const goalPct =
    target && target > 0 ? Math.min(100, (solved / target) * 100) : null;
  const overall = overallAccuracy(stats);

  const durationLabel = logged
    ? `${Math.floor(duration / 60)}h ${duration % 60}m`
    : "—";

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <h1 className="text-2xl font-bold">Today</h1>
      <p className="mt-1 text-sm">
        <span
          className={`font-semibold ${logged ? "text-emerald-600" : "text-zinc-500"}`}
        >
          {logged ? "Logged" : "Not logged yet"}
        </span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Study time" value={durationLabel} />
        <StatCard
          label="Goal progress"
          value={goalPct === null ? "—" : `${goalPct.toFixed(0)}%`}
        />
        <StatCard label="Questions solved" value={`${solved} / ${target ?? "—"}`} />
        <StatCard
          label="Overall accuracy"
          value={overall === null ? "—" : `${overall.toFixed(1)}%`}
        />
      </div>

      <Link
        href="/revision"
        className="mt-3 flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-950"
      >
        <span className="font-medium">Revision Due</span>
        <span className="font-semibold text-sky-700 dark:text-sky-300">
          {revisionDue ?? 0}
        </span>
      </Link>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-zinc-500">
        By subject
      </h2>
      <div className="flex flex-col gap-2">
        {SUBJECTS.map((s) => {
          const st = stats[s];
          const acc = subjectAccuracy(st.attempted, st.correct);
          return (
            <div
              key={s}
              className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <span className="font-medium">{prettySubject(s)}</span>
              <span className="text-sm text-zinc-500">
                {st.attempted} Q · {acc === null ? "—" : `${acc.toFixed(0)}%`}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-zinc-400">
        Open the Log tab to record or edit today&apos;s entry.
      </p>
    </main>
  );
}
