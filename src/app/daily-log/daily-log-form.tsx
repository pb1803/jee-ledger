"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  emptyStats,
  overallAccuracy,
  prettySubject,
  subjectAccuracy,
  todayISO,
  totals,
  type Stat,
  type SubjectStats,
} from "@/lib/study";
import { isOffline, OFFLINE_SAVE_MESSAGE } from "@/lib/network";
import type { Subject } from "@/lib/types";

const SUBJECTS: Subject[] = ["PHYSICS", "CHEMISTRY", "MATHEMATICS"];

interface Topic {
  id: string;
  subject: Subject;
  name: string;
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) =>
          onChange(
            e.target.value === ""
              ? 0
              : Math.max(0, Math.floor(Number(e.target.value))),
          )
        }
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-lg dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}

export default function DailyLogForm({ userId }: { userId: string }) {
  const supabase = createClient();

  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  const [stats, setStats] = useState<SubjectStats>(emptyStats());
  const [selectedTopics, setSelectedTopics] = useState<
    Record<Subject, string[]>
  >({ PHYSICS: [], CHEMISTRY: [], MATHEMATICS: [] });

  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState<Record<Subject, string>>({
    PHYSICS: "",
    CHEMISTRY: "",
    MATHEMATICS: "",
  });

  const [goalTarget, setGoalTarget] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const setStat = (subject: Subject, field: keyof Stat, value: number) => {
    setStats((prev) => ({
      ...prev,
      [subject]: { ...prev[subject], [field]: value },
    }));
  };

  const toggleTopic = (subject: Subject, id: string) => {
    setSelectedTopics((prev) => {
      const arr = prev[subject];
      return {
        ...prev,
        [subject]: arr.includes(id)
          ? arr.filter((x) => x !== id)
          : [...arr, id],
      };
    });
  };

  const addTopic = async (subject: Subject) => {
    const name = newTopic[subject].trim();
    if (!name) return;

    // Fast-path: skip the insert if we already know about this topic.
    const known = allTopics.find(
      (t) =>
        t.subject === subject && t.name.toLowerCase() === name.toLowerCase(),
    );
    if (known) {
      setNewTopic((prev) => ({ ...prev, [subject]: "" }));
      setSelectedTopics((prev) =>
        prev[subject].includes(known.id)
          ? prev
          : { ...prev, [subject]: [...prev[subject], known.id] },
      );
      return;
    }

    const { data, error: insErr } = await supabase
      .from("topics")
      .insert({ student_id: userId, subject, name })
      .select("id, name")
      .single();

    if (insErr) {
      // A concurrent insert of the same (case-insensitive) topic can hit the
      // DB-level unique constraint. Recover by selecting the existing row
      // instead of showing a generic error.
      if (insErr.code === "23505") {
        const { data: existingList } = await supabase
          .from("topics")
          .select("id, subject, name")
          .eq("student_id", userId)
          .eq("subject", subject);
        const existing = (existingList ?? []).find(
          (t) => t.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          const tid = (existing as { id: string }).id;
          setAllTopics((prev) =>
            prev.some((t) => t.id === tid)
              ? prev
              : [
                  ...prev,
                  {
                    id: tid,
                    subject,
                    name: (existing as { name: string }).name,
                  },
                ],
          );
          setNewTopic((prev) => ({ ...prev, [subject]: "" }));
          setSelectedTopics((prev) =>
            prev[subject].includes(tid)
              ? prev
              : { ...prev, [subject]: [...prev[subject], tid] },
          );
          return;
        }
      }
      setError(`Could not add topic "${name}". ${insErr.message}`);
      return;
    }

    const topicId = (data as { id: string }).id;
    setAllTopics((prev) => [...prev, { id: topicId, subject, name }]);
    setNewTopic((prev) => ({ ...prev, [subject]: "" }));
    setSelectedTopics((prev) =>
      prev[subject].includes(topicId)
        ? prev
        : { ...prev, [subject]: [...prev[subject], topicId] },
    );
  };

  // Load goal + topics (independent of the selected date).
  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: topics }, { data: goal }] = await Promise.all([
        supabase
          .from("topics")
          .select("id, subject, name")
          .eq("student_id", userId),
        supabase
          .from("goals")
          .select("target_value")
          .eq("student_id", userId)
          .eq("frequency", "DAILY")
          .eq("metric", "QUESTIONS_SOLVED")
          .maybeSingle(),
      ]);
      if (!active) return;
      setAllTopics((topics as Topic[]) ?? []);
      setGoalTarget(goal ? Number((goal as { target_value: unknown }).target_value) : null);
    })();
    return () => {
      active = false;
    };
  }, [userId, supabase]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: log } = await supabase
        .from("daily_logs")
        .select("id, study_duration_minutes")
        .eq("student_id", userId)
        .eq("log_date", date)
        .maybeSingle();
      if (!active) return;

      setLoading(true);
      setError(null);
      setSuccess(false);

      if (!log) {
        setHours(0);
        setMinutes(0);
        setStats(emptyStats());
        setSelectedTopics({ PHYSICS: [], CHEMISTRY: [], MATHEMATICS: [] });
        setLoading(false);
        return;
      }

      const dur = (log as { study_duration_minutes: number | null }).study_duration_minutes ?? 0;
      setHours(Math.floor(dur / 60));
      setMinutes(dur % 60);

      const { data: sds } = await supabase
        .from("subject_daily_stats")
        .select("subject, attempted, correct, incorrect")
        .eq("daily_log_id", (log as { id: string }).id);
      const nextStats = emptyStats();
      (sds ?? []).forEach((r) => {
        const s = (r as { subject: Subject }).subject;
        nextStats[s] = {
          attempted: (r as { attempted: number }).attempted ?? 0,
          correct: (r as { correct: number }).correct ?? 0,
          incorrect: (r as { incorrect: number }).incorrect ?? 0,
        };
      });
      setStats(nextStats);

      const { data: dlt } = await supabase
        .from("daily_log_topics")
        .select("topic_id")
        .eq("daily_log_id", (log as { id: string }).id);
      const ids = ((dlt ?? []) as { topic_id: string }[]).map((r) => r.topic_id);
      const { data: topicRows } = await supabase
        .from("topics")
        .select("id, subject")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const subjectOf = new Map<string, Subject>(
        ((topicRows ?? []) as { id: string; subject: Subject }[]).map((t) => [
          t.id,
          t.subject,
        ]),
      );
      const nextSel: Record<Subject, string[]> = {
        PHYSICS: [],
        CHEMISTRY: [],
        MATHEMATICS: [],
      };
      ids.forEach((id) => {
        const s = subjectOf.get(id);
        if (s) nextSel[s].push(id);
      });
      setSelectedTopics(nextSel);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId, date, supabase]);

  const validate = (): string | null => {
    if (hours < 0 || minutes < 0) return "Study duration cannot be negative.";
    if (!Number.isInteger(hours) || !Number.isInteger(minutes))
      return "Study duration must be whole numbers.";
    if (minutes > 59) return "Minutes must be between 0 and 59.";
    for (const s of SUBJECTS) {
      const st = stats[s];
      if (st.attempted < 0 || st.correct < 0 || st.incorrect < 0)
        return `${prettySubject(s)}: values cannot be negative.`;
      if (
        !Number.isInteger(st.attempted) ||
        !Number.isInteger(st.correct) ||
        !Number.isInteger(st.incorrect)
      )
        return `${prettySubject(s)}: values must be whole numbers.`;
      if (st.correct + st.incorrect > st.attempted)
        return `${prettySubject(s)}: correct + incorrect cannot exceed attempted.`;
    }
    return null;
  };

  const onSave = async () => {
    setSuccess(false);
    if (isOffline()) {
      setError(OFFLINE_SAVE_MESSAGE);
      return;
    }
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const duration = hours * 60 + minutes;

      const { data: log, error: logErr } = await supabase
        .from("daily_logs")
        .upsert(
          { student_id: userId, log_date: date, study_duration_minutes: duration },
          { onConflict: "student_id,log_date" },
        )
        .select("id")
        .single();
      if (logErr) throw logErr;
      const dailyLogId = (log as { id: string }).id;

      const statRows = SUBJECTS.map((s) => ({
        daily_log_id: dailyLogId,
        subject: s,
        attempted: stats[s].attempted,
        correct: stats[s].correct,
        incorrect: stats[s].incorrect,
      }));
      const { error: statErr } = await supabase
        .from("subject_daily_stats")
        .upsert(statRows, { onConflict: "daily_log_id,subject" });
      if (statErr) throw statErr;

      const { error: delErr } = await supabase
        .from("daily_log_topics")
        .delete()
        .eq("daily_log_id", dailyLogId);
      if (delErr) throw delErr;

      const links = SUBJECTS.flatMap((s) =>
        selectedTopics[s].map((tid) => ({
          daily_log_id: dailyLogId,
          topic_id: tid,
        })),
      );
      if (links.length > 0) {
        const { error: insErr } = await supabase
          .from("daily_log_topics")
          .insert(links);
        if (insErr) throw insErr;
      }

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const t = totals(stats);
  const solved = t.attempted;
  const goalPct =
    goalTarget && goalTarget > 0
      ? Math.min(100, (solved / goalTarget) * 100)
      : null;
  const overall = overallAccuracy(stats);

  if (loading) {
    return <p className="py-10 text-center text-zinc-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberInput label="Hours" value={hours} onChange={setHours} />
          <NumberInput label="Minutes" value={minutes} onChange={setMinutes} />
        </div>

        <div className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-900">
          <div className="flex justify-between">
            <span>Questions solved</span>
            <span className="font-semibold">
              {solved} / {goalTarget ?? "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Daily goal progress</span>
            <span className="font-semibold">
              {goalPct === null ? "—" : `${goalPct.toFixed(0)}%`}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Overall accuracy</span>
            <span className="font-semibold">
              {overall === null ? "—" : `${overall.toFixed(1)}%`}
            </span>
          </div>
        </div>
      </div>

      {SUBJECTS.map((subject) => {
        const st = stats[subject];
        const acc = subjectAccuracy(st.attempted, st.correct);
        const subjectTopics = allTopics.filter((t) => t.subject === subject);
        return (
          <section
            key={subject}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {prettySubject(subject)}
              </h2>
              <span className="text-sm text-zinc-500">
                {acc === null ? "—" : `${acc.toFixed(1)}%`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <NumberInput
                label="Attempted"
                value={st.attempted}
                onChange={(v) => setStat(subject, "attempted", v)}
              />
              <NumberInput
                label="Correct"
                value={st.correct}
                onChange={(v) => setStat(subject, "correct", v)}
              />
              <NumberInput
                label="Incorrect"
                value={st.incorrect}
                onChange={(v) => setStat(subject, "incorrect", v)}
              />
            </div>

            <p className="mb-1 mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Topics studied
            </p>
            <div className="flex flex-wrap gap-2">
              {subjectTopics.map((topic) => {
                const on = selectedTopics[subject].includes(topic.id);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => toggleTopic(subject, topic.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      on
                        ? "bg-sky-600 text-white"
                        : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"
                    }`}
                  >
                    {topic.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newTopic[subject]}
                onChange={(e) =>
                  setNewTopic((p) => ({ ...p, [subject]: e.target.value }))
                }
                placeholder="Add topic…"
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() => addTopic(subject)}
                className="rounded-lg bg-zinc-200 px-3 py-2 text-sm font-medium dark:bg-zinc-800"
              >
                Add
              </button>
            </div>
          </section>
        );
      })}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Saved for {date}.
        </p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-lg bg-sky-600 px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
