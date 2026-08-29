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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center dark:bg-zinc-900">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const d = await getDashboardData(supabase, user.id);

  const goalPct =
    d.goalTarget && d.goalTarget > 0
      ? Math.min(100, (d.todayAttempted / d.goalTarget) * 100)
      : null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <h1 className="text-2xl font-bold">Progress</h1>
      <p className="mt-0.5 text-xs text-zinc-400">
        {new Date(d.today).toLocaleDateString("en-IN", {
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: d.tz,
        })}
      </p>

      {/* 1. Today */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">Today</h2>
      {!d.hasToday ? (
        <Card>
          <p className="text-sm text-zinc-500">You haven&apos;t logged today yet.</p>
          <Link
            href="/daily-log"
            className="mt-2 inline-block rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Log today
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Attempted" value={num(d.todayAttempted)} />
          <Stat
            label="Target"
            value={d.goalTarget ? num(d.goalTarget) : "—"}
          />
          <Stat
            label="Accuracy"
            value={d.todayAccuracy == null ? "—" : pct(d.todayAccuracy)}
          />
          <Stat label="Correct" value={num(d.todayCorrect)} />
          <Stat label="Incorrect" value={num(d.todayIncorrect)} />
          <Stat label="Study time" value={formatMinutes(d.todayDurationMin)} />
        </div>
      )}

      {/* 2. Subject breakdown (last 30 days) */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Subject breakdown
        <span className="ml-1 font-normal text-zinc-400">(30 days)</span>
      </h2>
      <div className="flex flex-col gap-2">
        {SUBJECTS.map((s) => {
          const sb = d.subjectBreakdown[s];
          return (
            <Card key={s} className="flex items-center justify-between">
              <span className="font-medium">{prettySubject(s)}</span>
              <span className="text-sm text-zinc-500">
                {num(sb.attempted)} Q · {pct(sb.accuracy)}
              </span>
            </Card>
          );
        })}
      </div>

      {/* 3. Weekly progress chart */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Weekly progress
      </h2>
      <Card>
        <WeekBars series={d.series7} />
        <div className="mt-2 flex justify-between text-xs text-zinc-500">
          <span>{num(d.agg7.attempted)} questions</span>
          <span>{pct(d.acc7)} accuracy</span>
        </div>
      </Card>

      {/* 4. Weekly subject comparison */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Subject comparison
        <span className="ml-1 font-normal text-zinc-400">(7 days)</span>
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
              <p className="text-[11px] text-zinc-400">
                <span className="text-emerald-600">{num(sb.correct)} correct</span>{" "}
                · <span className="text-red-500">{num(sb.incorrect)} incorrect</span>
              </p>
            </Card>
          );
        })}
      </div>

      {/* 5. Consistency */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Consistency
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Current streak" value={`${d.streakCurrent} d`} />
        <Stat label="Longest streak" value={`${d.streakLongest} d`} />
        <Stat label="Logged (7d)" value={`${d.logged7} d`} />
        <Stat label="Logged (30d)" value={`${d.logged30} d`} />
      </div>

      {/* 6 + 7. Trends & study time */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Solving & study time
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="7-day total" value={num(d.agg7.attempted)} />
        <Stat label="30-day total" value={num(d.agg30.attempted)} />
        <Stat
          label="Avg / logged day"
          value={
            d.avgAttemptedPerLoggedDay7 == null
              ? "—"
              : num(Math.round(d.avgAttemptedPerLoggedDay7))
          }
        />
        <Stat label="7-day accuracy" value={pct(d.acc7)} />
        <Stat
          label="Study (7d)"
          value={formatMinutes(d.agg7.dur)}
        />
        <Stat
          label="Study (30d)"
          value={formatMinutes(d.agg30.dur)}
        />
        <Stat
          label="Avg study / day"
          value={d.avgStudyMin7 == null ? "—" : formatMinutes(d.avgStudyMin7)}
        />
        <Stat label="30-day accuracy" value={pct(d.acc30)} />
      </div>

      {/* 8. Topic coverage */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Topic coverage
      </h2>
      <Card className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Unique topics studied</span>
          <span className="font-medium">
            {d.topics7Count} / 7d · {d.topics30Count} / 30d
          </span>
        </div>
        {d.recentTopics.length === 0 ? (
          <p className="text-sm text-zinc-400">No topics logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {d.recentTopics.slice(0, 8).map((t) => (
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
          Topic-level accuracy needs topic-level question stats (future phase);
          this list shows what was studied recently, not a mastery score.
        </p>
      </Card>

      {/* 9. Important-question backlog */}
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

      {/* 10. Goal progress */}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
        Daily goal
      </h2>
      {d.goalTarget == null && d.studyGoalMin == null ? (
        <Card>
          <p className="text-sm text-zinc-500">No daily target set.</p>
          <Link
            href="/settings"
            className="mt-2 inline-block rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Set a daily target
          </Link>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          {d.goalTarget != null && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Questions</span>
                <span className="font-semibold tabular-nums">
                  {d.todayAttempted} / {d.goalTarget}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-sky-600"
                  style={{ width: `${goalPct ?? 0}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                {goalPct == null
                  ? "—"
                  : `${Math.round(goalPct)}% of daily question target`}
              </p>
            </div>
          )}
          {d.studyGoalMin != null && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Study time</span>
                <span className="font-semibold tabular-nums">
                  {formatMinutes(d.todayDurationMin)} / {formatMinutes(d.studyGoalMin)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-sky-600"
                  style={{
                    width: `${Math.min(
                      100,
                      d.studyGoalMin > 0
                        ? (d.todayDurationMin / d.studyGoalMin) * 100
                        : 0,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                {d.studyGoalMin > 0
                  ? `${Math.round(
                      Math.min(100, (d.todayDurationMin / d.studyGoalMin) * 100),
                    )}% of daily study target`
                  : "—"}
              </p>
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
