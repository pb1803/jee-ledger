import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subject } from "./types";
import {
  emptyStats,
  subjectAccuracy,
  type SubjectStats,
} from "./study";
import {
  accuracyPct,
  buildDailySeries,
  computeStreaks,
  dateRangeDays,
  daysLoggedInRange,
  shiftDate,
  todayInTZ,
  type DayPoint,
  type DayStat,
} from "./analytics";
import type { RevisionStatus } from "./questions";

export interface SubjectBreakdown {
  attempted: number;
  correct: number;
  incorrect: number;
  accuracy: number | null;
}

export interface RecentTopic {
  name: string;
  subject: Subject;
  lastDate: string;
}

export interface IqSummary {
  total: number;
  NOT_STARTED: number;
  IN_PROGRESS: number;
  DONE: number;
  due: number;
  bySubject: Record<Subject, { total: number; due: number; done: number }>;
}

export interface DashboardData {
  tz: string;
  today: string;
  hasToday: boolean;
  todayAttempted: number;
  todayCorrect: number;
  todayIncorrect: number;
  todayAccuracy: number | null;
  todayDurationMin: number;
  subjectBreakdown: Record<Subject, SubjectBreakdown>;
  series7: DayPoint[];
  series30: DayPoint[];
  agg7: { attempted: number; correct: number; incorrect: number; dur: number };
  agg30: { attempted: number; correct: number; incorrect: number; dur: number };
  acc7: number | null;
  acc30: number | null;
  avgAttemptedPerLoggedDay7: number | null;
  avgStudyMin7: number | null;
  streakCurrent: number;
  streakLongest: number;
  logged7: number;
  logged30: number;
  recentTopics: RecentTopic[];
  topics7Count: number;
  topics30Count: number;
  iq: IqSummary;
  goalTarget: number | null;
  studyGoalMin: number | null;
  revisionDue: number;
}

function emptyIqBySubject(): IqSummary["bySubject"] {
  return {
    PHYSICS: { total: 0, due: 0, done: 0 },
    CHEMISTRY: { total: 0, due: 0, done: 0 },
    MATHEMATICS: { total: 0, due: 0, done: 0 },
  };
}

export async function getDashboardData(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardData> {
  const { data: profile } = await supabase
    .from("profile")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  const tz = (profile?.timezone as string) || "Asia/Kolkata";
  const today = todayInTZ(tz);

  // All daily logs for the student (used for streaks + range counts).
  const { data: allLogs } = await supabase
    .from("daily_logs")
    .select("id, log_date, study_duration_minutes")
    .eq("student_id", userId);
  const logs = (allLogs ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    log_date: l.log_date as string,
    study_duration_minutes: (l.study_duration_minutes as number | null) ?? 0,
  }));
  const allLogDates = logs.map((l) => l.log_date);

  const { current: streakCurrent, longest: streakLongest } = computeStreaks(
    allLogDates,
    today,
  );

  const min30 = shiftDate(today, -29);
  const logs30 = logs.filter((l) => l.log_date >= min30);
  const ids30 = logs30.map((l) => l.id);

  // Subject stats for the window (single query via IN on parent log ids).
  const { data: stats30 } = ids30.length
    ? await supabase
        .from("subject_daily_stats")
        .select("daily_log_id, subject, attempted, correct, incorrect")
        .in("daily_log_id", ids30)
    : { data: [] as Record<string, unknown>[] };

  const logDateById = new Map(logs30.map((l) => [l.id, l.log_date]));
  const statByDate = new Map<string, DayStat>();
  const durationByDate = new Map<string, number>();
  for (const l of logs30) {
    durationByDate.set(
      l.log_date,
      (durationByDate.get(l.log_date) ?? 0) + l.study_duration_minutes,
    );
  }
  for (const s of stats30 ?? []) {
    const date = logDateById.get(s.daily_log_id as string);
    if (!date) continue;
    const cur =
      statByDate.get(date) ??
      { attempted: 0, correct: 0, incorrect: 0, durationMin: 0 };
    cur.attempted += (s.attempted as number) ?? 0;
    cur.correct += (s.correct as number) ?? 0;
    cur.incorrect += (s.incorrect as number) ?? 0;
    statByDate.set(date, cur);
  }
  for (const [date, dur] of durationByDate) {
    const cur =
      statByDate.get(date) ??
      { attempted: 0, correct: 0, incorrect: 0, durationMin: 0 };
    cur.durationMin += dur;
    statByDate.set(date, cur);
  }

  const days7 = dateRangeDays(today, 7);
  const days30 = dateRangeDays(today, 30);
  const series7 = buildDailySeries(days7, statByDate);
  const series30 = buildDailySeries(days30, statByDate);

  const agg = (series: DayPoint[]) => {
    let attempted = 0;
    let correct = 0;
    let incorrect = 0;
    let dur = 0;
    for (const p of series) {
      attempted += p.attempted;
      correct += p.correct;
      incorrect += p.incorrect;
      dur += p.durationMin;
    }
    return { attempted, correct, incorrect, dur };
  };
  const agg7 = agg(series7);
  const agg30 = agg(series30);
  const acc7 = accuracyPct(agg7.correct, agg7.attempted);
  const acc30 = accuracyPct(agg30.correct, agg30.attempted);

  const logged7 = daysLoggedInRange(allLogDates, days7[0], today);
  const logged30 = daysLoggedInRange(allLogDates, days30[0], today);
  const avgAttemptedPerLoggedDay7 = logged7
    ? agg7.attempted / logged7
    : null;
  const avgStudyMin7 = logged7 ? agg7.dur / logged7 : null;

  // Subject breakdown (30-day window).
  const subjectStats: SubjectStats = emptyStats();
  for (const s of stats30 ?? []) {
    const sub = s.subject as Subject;
    subjectStats[sub].attempted += (s.attempted as number) ?? 0;
    subjectStats[sub].correct += (s.correct as number) ?? 0;
    subjectStats[sub].incorrect += (s.incorrect as number) ?? 0;
  }
  const subjectBreakdown = {} as Record<Subject, SubjectBreakdown>;
  (Object.keys(subjectStats) as Subject[]).forEach((sub) => {
    const st = subjectStats[sub];
    subjectBreakdown[sub] = {
      attempted: st.attempted,
      correct: st.correct,
      incorrect: st.incorrect,
      accuracy: subjectAccuracy(st.attempted, st.correct),
    };
  });

  // Today's snapshot.
  const todayLog = logs.find((l) => l.log_date === today) ?? null;
  const todayStat = todayLog ? statByDate.get(todayLog.log_date) ?? null : null;
  const hasToday = !!todayLog;
  const todayAttempted = todayStat?.attempted ?? 0;
  const todayCorrect = todayStat?.correct ?? 0;
  const todayIncorrect = todayStat?.incorrect ?? 0;
  const todayAccuracy = todayStat
    ? accuracyPct(todayStat.correct, todayStat.attempted)
    : null;
  const todayDurationMin = todayLog?.study_duration_minutes ?? 0;

  // Important questions summary.
  const { data: iqs } = await supabase
    .from("important_questions")
    .select("revision_status, subject")
    .eq("student_id", userId);
  const iq: IqSummary = {
    total: (iqs ?? []).length,
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    DONE: 0,
    due: 0,
    bySubject: emptyIqBySubject(),
  };
  for (const row of iqs ?? []) {
    const status = row.revision_status as RevisionStatus;
    const sub = row.subject as Subject;
    iq[status] += 1;
    iq.bySubject[sub].total += 1;
    if (status === "DONE") iq.bySubject[sub].done += 1;
    if (status === "NOT_STARTED" || status === "IN_PROGRESS") {
      iq.due += 1;
      iq.bySubject[sub].due += 1;
    }
  }

  // Recently studied topics (last 30 days), keeping last studied date per topic.
  let recentTopics: RecentTopic[] = [];
  if (ids30.length) {
    const { data: dlt } = await supabase
      .from("daily_log_topics")
      .select("topic_id, daily_logs(log_date), topics(name, subject)")
      .in("daily_log_id", ids30);
    const map = new Map<string, RecentTopic>();
    for (const r of dlt ?? []) {
      const date = (r.daily_logs as { log_date?: string } | null)?.log_date;
      const t = r.topics as { name?: string; subject?: Subject } | null;
      if (!date || !t?.name || !t?.subject) continue;
      const cur = map.get(r.topic_id as string);
      if (!cur || date > cur.lastDate) {
        map.set(r.topic_id as string, {
          name: t.name,
          subject: t.subject,
          lastDate: date,
        });
      }
    }
    recentTopics = [...map.values()].sort((a, b) =>
      b.lastDate.localeCompare(a.lastDate),
    );
  }
  const topics7Count = recentTopics.filter((t) => t.lastDate >= days7[0]).length;
  const topics30Count = recentTopics.length;

  // Daily goals (one per metric).
  const { data: goals } = await supabase
    .from("goals")
    .select("metric, target_value")
    .eq("student_id", userId)
    .eq("frequency", "DAILY");
  const goalTarget = goals
    ? Number(
        (goals.find((g) => g.metric === "QUESTIONS_SOLVED") as
          | { target_value: unknown }
          | undefined)?.target_value ?? NaN,
      )
    : NaN;
  const studyGoalMin = goals
    ? Number(
        (goals.find((g) => g.metric === "STUDY_MINUTES") as
          | { target_value: unknown }
          | undefined)?.target_value ?? NaN,
      )
    : NaN;

  return {
    tz,
    today,
    hasToday,
    todayAttempted,
    todayCorrect,
    todayIncorrect,
    todayAccuracy,
    todayDurationMin,
    subjectBreakdown,
    series7,
    series30,
    agg7,
    agg30,
    acc7,
    acc30,
    avgAttemptedPerLoggedDay7,
    avgStudyMin7,
    streakCurrent,
    streakLongest,
    logged7,
    logged30,
    recentTopics,
    topics7Count,
    topics30Count,
    iq,
    goalTarget: Number.isNaN(goalTarget) ? null : goalTarget,
    studyGoalMin: Number.isNaN(studyGoalMin) ? null : studyGoalMin,
    revisionDue: iq.due,
  };
}
