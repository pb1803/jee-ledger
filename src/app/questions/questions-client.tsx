"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuestionForm from "./question-form";
import { prettySubject } from "@/lib/study";
import {
  INPUT_TYPE_LABELS,
  PRIORITY_LABELS,
  REVISION_LABELS,
  type QuestionListItem,
  type TopicOption,
} from "@/lib/questions";

export default function QuestionsClient({
  questions,
  topics,
  userId,
}: {
  questions: QuestionListItem[];
  topics: TopicOption[];
  userId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = questions.filter((q) =>
    q.question_name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Important Questions</h1>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white"
        >
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>

      {adding && (
        <div className="mb-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <QuestionForm
            userId={userId}
            topics={topics}
            onSaved={() => {
              setAdding(false);
              router.refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name…"
        className="mb-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      <ul className="flex flex-col gap-2">
        {filtered.map((q) => (
          <li key={q.id}>
            <Link
              href={`/questions/${q.id}`}
              className="block rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{q.question_name}</span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {INPUT_TYPE_LABELS[q.input_type]}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {prettySubject(q.subject)} · {q.topicName ?? "—"} ·{" "}
                {PRIORITY_LABELS[q.priority]} · {REVISION_LABELS[q.revision_status]}
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-6 text-center text-sm text-zinc-400">
            No questions yet.
          </li>
        )}
      </ul>
    </main>
  );
}
