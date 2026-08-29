import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/analytics-data";
import { WeekBars } from "@/components/week-bars";
import { formatMinutes } from "@/lib/analytics";
import { prettySubject } from "@/lib/study";
import type { Subject } from "@/lib/types";

const SUBJECTS: Subject[] = ["PHYSICS", "CHEMISTRY", "MATHEMATICS"];

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);
const num = (n: number) => n.toLocaleString("en-IN");

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 ${className}`}
    >
      {children}
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const d = await getDashboardData(supabase, user.id);

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="mt-0.5 text-xs text-zinc-400">
        Detailed history · timezone {d.tz}
      </p>

      {/* 7-day chart */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Last 7 days
      </h2>
      <Card>
        <WeekBars series={d.series7} />
        <div className="mt-2 flex justify-between text-xs text-zinc-500">
          <span>{num(d.agg7.attempted)} questions</span>
          <span>{formatMinutes(d.agg7.dur)} studied</span>
          <span>{pct(d.acc7)} accuracy</span>
        </div>
      </Card>

      {/* 30-day summary */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Last 30 days
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] text-zinc-500">Questions</p>
          <p className="text-base font-semibold tabular-nums">
            {num(d.agg30.attempted)}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] text-zinc-500">Accuracy</p>
          <p className="text-base font-semibold tabular-nums">{pct(d.acc30)}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] text-zinc-500">Study time</p>
          <p className="text-base font-semibold tabular-nums">
            {formatMinutes(d.agg30.dur)}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] text-zinc-500">Avg / logged day</p>
          <p className="text-base font-semibold tabular-nums">
            {d.avgAttemptedPerLoggedDay7 == null
              ? "—"
              : num(Math.round(d.avgAttemptedPerLoggedDay7))}
          </p>
        </div>
      </div>

      {/* Subject comparison (30-day) */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Subject breakdown
      </h2>
      <div className="flex flex-col gap-2">
        {SUBJECTS.map((s) => {
          const sb = d.subjectBreakdown[s];
          const total = sb.attempted;
          const correctW = total ? (sb.correct / total) * 100 : 0;
          return (
            <Card key={s} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{prettySubject(s)}</span>
                <span className="text-zinc-500">
                  {num(total)} Q · {pct(sb.accuracy)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="bg-emerald-500" style={{ width: `${correctW}%` }} />
                <div
                  className="bg-red-400"
                  style={{ width: `${100 - correctW}%` }}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Consistency */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Consistency
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] text-zinc-500">Current streak</p>
          <p className="text-base font-semibold tabular-nums">
            {d.streakCurrent} d
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] text-zinc-500">Longest streak</p>
          <p className="text-base font-semibold tabular-nums">
            {d.streakLongest} d
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] text-zinc-500">Days logged (7d)</p>
          <p className="text-base font-semibold tabular-nums">{d.logged7}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center dark:bg-zinc-900">
          <p className="text-[11px] text-zinc-500">Days logged (30d)</p>
          <p className="text-base font-semibold tabular-nums">{d.logged30}</p>
        </div>
      </div>

      {/* Topic coverage */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Recently studied topics
      </h2>
      <Card className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Unique topics</span>
          <span className="font-medium">
            {d.topics7Count} / 7d · {d.topics30Count} / 30d
          </span>
        </div>
        {d.recentTopics.length === 0 ? (
          <p className="text-sm text-zinc-400">No topics logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {d.recentTopics.map((t) => (
              <li
                key={`${t.name}-${t.lastDate}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {prettySubject(t.subject)} ·{" "}
                  {new Date(t.lastDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: d.tz,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-zinc-400">
          Weak-topic detection is intentionally not implemented: question
          performance is only stored at subject level, not per topic. A topic
          mastery/accuracy score would require topic-level stats in a future
          phase.
        </p>
      </Card>

      {/* Important questions */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Important questions
      </h2>
      <Card className="flex flex-col gap-2">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-base font-semibold">{d.iq.total}</p>
            <p className="text-[11px] text-zinc-500">Total</p>
          </div>
          <div>
            <p className="text-base font-semibold text-zinc-500">
              {d.iq.NOT_STARTED}
            </p>
            <p className="text-[11px] text-zinc-500">New</p>
          </div>
          <div>
            <p className="text-base font-semibold text-amber-600">
              {d.iq.IN_PROGRESS}
            </p>
            <p className="text-[11px] text-zinc-500">Doing</p>
          </div>
          <div>
            <p className="text-base font-semibold text-emerald-600">
              {d.iq.DONE}
            </p>
            <p className="text-[11px] text-zinc-500">Done</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {SUBJECTS.map((s) => (
            <span
              key={s}
              className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-900"
            >
              {prettySubject(s)}: {d.iq.bySubject[s].due} due
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Link
            href="/questions"
            className="flex-1 rounded-lg border border-zinc-300 py-2 text-center text-sm font-medium dark:border-zinc-700"
          >
            All questions
          </Link>
          <Link
            href="/revision"
            className="flex-1 rounded-lg bg-sky-600 py-2 text-center text-sm font-semibold text-white"
          >
            Revise ({d.revisionDue})
          </Link>
        </div>
      </Card>
    </main>
  );
}
