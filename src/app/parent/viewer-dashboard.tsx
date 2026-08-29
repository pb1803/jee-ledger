"use client";

import { WeekBars } from "@/components/week-bars";
import { formatMinutes } from "@/lib/analytics";
import { prettySubject } from "@/lib/study";
import type { DashboardData } from "@/lib/analytics-data";
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

export function ViewerDashboard({ data }: { data: DashboardData }) {
  const d = data;
  const hasAnyData =
    d.agg30.attempted > 0 || d.iq.total > 0 || d.todayAttempted > 0;

  const goalPct =
    d.goalTarget && d.goalTarget > 0
      ? Math.min(100, (d.todayAttempted / d.goalTarget) * 100)
      : null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <h1 className="text-2xl font-bold">Mentor overview</h1>
      <p className="mt-0.5 text-xs text-zinc-400">
        Read-only view · {d.studentName || "Student"}
      </p>

      {!hasAnyData ? (
        <Card className="mt-4">
          <p className="text-sm text-zinc-500">
            No data is visible yet. Either the student hasn&apos;t granted you
            access, or there is nothing logged. Ask the student to grant access
            from their Settings → Mentors.
          </p>
        </Card>
      ) : (
        <>
          {/* Today */}
          <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
            Today
          </h2>
          {!d.hasToday ? (
            <Card>
              <p className="text-sm text-zinc-500">No log for today yet.</p>
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

          {/* Subject breakdown */}
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

          {/* Weekly progress */}
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

          {/* Consistency */}
          <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
            Consistency
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Current streak" value={`${d.streakCurrent} d`} />
            <Stat label="Longest streak" value={`${d.streakLongest} d`} />
            <Stat label="Logged (7d)" value={`${d.logged7} d`} />
            <Stat label="Logged (30d)" value={`${d.logged30} d`} />
          </div>

          {/* Study time */}
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
            <Stat label="Study (7d)" value={formatMinutes(d.agg7.dur)} />
            <Stat label="Study (30d)" value={formatMinutes(d.agg30.dur)} />
            <Stat
              label="Avg study / day"
              value={d.avgStudyMin7 == null ? "—" : formatMinutes(d.avgStudyMin7)}
            />
            <Stat label="30-day accuracy" value={pct(d.acc30)} />
          </div>

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
            <p className="text-xs text-zinc-500">
              {d.revisionDue} question{d.revisionDue === 1 ? "" : "s"} due for
              revision.
            </p>
          </Card>

          {/* Daily goal */}
          <h2 className="mb-2 mt-5 text-sm font-semibold text-zinc-500">
            Daily goal
          </h2>
          {d.goalTarget == null && d.studyGoalMin == null ? (
            <Card>
              <p className="text-sm text-zinc-500">No daily target set.</p>
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
                </div>
              )}
              {d.studyGoalMin != null && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500">Study time</span>
                    <span className="font-semibold tabular-nums">
                      {formatMinutes(d.todayDurationMin)} /{" "}
                      {formatMinutes(d.studyGoalMin)}
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
                </div>
              )}
            </Card>
          )}

          <p className="mt-6 text-center text-[11px] text-zinc-400">
            This is a read-only summary. You cannot add or change data.
          </p>
        </>
      )}
    </main>
  );
}
