"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { prettySubject } from "@/lib/study";
import {
  PRIORITY_LABELS,
  REVISION_LABELS,
  type QuestionListItem,
  type RevisionStatus,
} from "@/lib/questions";
import type { Subject } from "@/lib/types";

interface QueueRow {
  id: string;
  question_name: string;
  subject: Subject;
  topicName: string | null;
  priority: QuestionListItem["priority"];
  revision_status: RevisionStatus;
  lastRevisionDate: string | null;
}

const SUBJECTS: Subject[] = ["PHYSICS", "CHEMISTRY", "MATHEMATICS"];
const NEEDS_REVISION: RevisionStatus[] = ["NOT_STARTED", "IN_PROGRESS"];

export default function RevisionClient({ items }: { items: QueueRow[] }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [subject, setSubject] = useState<Subject | "ALL">("ALL");

  const filtered = useMemo(
    () =>
      items.filter((q) => {
        if (subject !== "ALL" && q.subject !== subject) return false;
        if (!showCompleted && !NEEDS_REVISION.includes(q.revision_status))
          return false;
        return true;
      }),
    [items, showCompleted, subject],
  );

  const dueCount = items.filter((q) =>
    NEEDS_REVISION.includes(q.revision_status),
  ).length;

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <h1 className="text-xl font-bold">Revision</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {dueCount} question{dueCount === 1 ? "" : "s"} need
        {dueCount === 1 ? "s" : ""} revision.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show Completed
        </label>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value as Subject | "ALL")}
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="ALL">All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {prettySubject(s)}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {filtered.map((q) => (
          <li key={q.id}>
            <Link
              href={`/questions/${q.id}`}
              className="block rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{q.question_name}</span>
                <span
                  className={`shrink-0 text-xs ${
                    q.revision_status === "DONE"
                      ? "text-emerald-600"
                      : q.revision_status === "IN_PROGRESS"
                        ? "text-amber-600"
                        : "text-zinc-500"
                  }`}
                >
                  {REVISION_LABELS[q.revision_status]}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {prettySubject(q.subject)} · {q.topicName ?? "—"} ·{" "}
                {PRIORITY_LABELS[q.priority]}
                {q.lastRevisionDate
                  ? ` · last ${new Date(q.lastRevisionDate).toLocaleDateString()}`
                  : ""}
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-8 text-center text-sm text-zinc-400">
            {showCompleted
              ? "No questions yet."
              : "No questions need revision right now."}
          </li>
        )}
      </ul>
    </main>
  );
}
