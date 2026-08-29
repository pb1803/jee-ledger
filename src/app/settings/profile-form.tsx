"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isOffline, OFFLINE_SAVE_MESSAGE } from "@/lib/network";
import { SignOutButton } from "@/components/sign-out-button";
import type { ExamTarget, ProfileRow } from "@/lib/types";

const EXAMS: ExamTarget[] = ["JEE_MAIN", "JEE_ADV", "MHT_CET"];

// Curated, valid IANA timezones. A fixed list avoids accepting malformed
// timezone strings while covering the regions a JEE student is likely in.
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Colombo",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Karachi",
  "UTC",
];

export function ProfileForm({ initial }: { initial: ProfileRow | null }) {
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [grade, setGrade] = useState<string>(
    initial?.grade ? String(initial.grade) : "11",
  );
  const [examTargets, setExamTargets] = useState<ExamTarget[]>(
    initial?.exam_targets ?? ["JEE_MAIN", "JEE_ADV", "MHT_CET"],
  );
  const [timezone, setTimezone] = useState<string>(
    initial?.timezone || "Asia/Kolkata",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleExam(exam: ExamTarget) {
    setExamTargets((prev) =>
      prev.includes(exam)
        ? prev.filter((e) => e !== exam)
        : [...prev, exam],
    );
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    if (isOffline()) {
      setMessage(OFFLINE_SAVE_MESSAGE);
      setSaving(false);
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("profile").upsert(
      {
        id: user.id,
        display_name: displayName,
        grade: Number(grade),
        exam_targets: examTargets,
        timezone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    setMessage(error ? error.message : "Saved.");
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Display name</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Grade</span>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="11">11</option>
          <option value="12">12</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Timezone</span>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Exam targets</span>
        <div className="flex flex-wrap gap-2">
          {EXAMS.map((exam) => {
            const active = examTargets.includes(exam);
            return (
              <button
                key={exam}
                type="button"
                onClick={() => toggleExam(exam)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-sky-600 text-white"
                    : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"
                }`}
              >
                {exam}
              </button>
            );
          })}
        </div>
      </div>

      {message && <p className="text-sm text-zinc-500">{message}</p>}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-lg bg-sky-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>

      <SignOutButton
        label="Lock app"
        className="rounded-lg border border-zinc-300 px-4 py-2.5 font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      />
    </div>
  );
}
