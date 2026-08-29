"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import QuestionForm from "./question-form";
import DeleteQuestionButton from "./delete-question-button";
import { getSignedImageUrl } from "@/lib/image";
import { recordRevision, type RevisionRecord } from "@/lib/revisions";
import { prettySubject } from "@/lib/study";
import {
  INPUT_TYPE_LABELS,
  PRIORITY_LABELS,
  REVISION_LABELS,
  REVISION_OUTCOME_LABELS,
  type ImportantQuestion,
  type RevisionOutcome,
  type TopicOption,
} from "@/lib/questions";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-200 py-2 text-sm dark:border-zinc-800">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export default function QuestionDetail({
  question,
  topicName,
  topics,
  userId,
  revisions,
}: {
  question: ImportantQuestion;
  topicName: string | null;
  topics: TopicOption[];
  userId: string;
  revisions: RevisionRecord[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);

  // Revision recording UI state.
  const [showRevForm, setShowRevForm] = useState(false);
  const [outcome, setOutcome] = useState<RevisionOutcome | null>(null);
  const [revNotes, setRevNotes] = useState("");
  const [savingRev, setSavingRev] = useState(false);
  const [revErr, setRevErr] = useState<string | null>(null);

  async function saveRevision() {
    if (!outcome) return;
    setSavingRev(true);
    setRevErr(null);
    try {
      const supabase = createClient();
      await recordRevision(supabase, question.id, outcome, revNotes);
      setShowRevForm(false);
      setOutcome(null);
      setRevNotes("");
      router.refresh();
    } catch (err) {
      setRevErr(
        err instanceof Error ? err.message : "Could not save revision.",
      );
    } finally {
      setSavingRev(false);
    }
  }

  useEffect(() => {
    if (question.input_type === "IMAGE" && question.image_path) {
      const supabase = createClient();
      let active = true;
      getSignedImageUrl(supabase, question.image_path).then((url) => {
        if (!active) return;
        if (url) setImgUrl(url);
        else setImgErr("Could not load image.");
      });
      return () => {
        active = false;
      };
    }
  }, [question.input_type, question.image_path]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-24">
      <button
        type="button"
        onClick={() => router.push("/questions")}
        className="mb-3 text-sm font-medium text-sky-600"
      >
        ← Back
      </button>

      <h1 className="text-xl font-bold">{question.question_name}</h1>

      {editing ? (
        <div className="mt-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <QuestionForm
            userId={userId}
            topics={topics}
            initial={question}
            onSaved={() => {
              setEditing(false);
              router.refresh();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="mt-3">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <Field label="Subject" value={prettySubject(question.subject)} />
            <Field label="Topic" value={topicName ?? "—"} />
            <Field label="Source" value={question.source ?? "—"} />
            <Field label="Priority" value={PRIORITY_LABELS[question.priority]} />
            <Field label="Type" value={INPUT_TYPE_LABELS[question.input_type]} />
            <Field
              label="Revision"
              value={REVISION_LABELS[question.revision_status]}
            />
            <Field label="Notes" value={question.notes ?? "—"} />
            <Field
              label="Added"
              value={new Date(question.created_at).toLocaleDateString()}
            />
          </div>

          {question.input_type === "TEXT" && (
            <div className="mt-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="mb-1 text-xs text-zinc-500">Question text</p>
              <p className="whitespace-pre-wrap text-sm">
                {question.question_text}
              </p>
            </div>
          )}

          {question.input_type === "URL" && question.external_url && (
            <a
              href={question.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-xl border border-zinc-200 p-4 font-medium text-sky-600 dark:border-zinc-800"
            >
              Open Question ↗
            </a>
          )}

          {question.input_type === "IMAGE" && question.image_path && (
            <div className="mt-3 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
              {imgUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgUrl}
                  alt={question.question_name}
                  className="w-full rounded-lg object-contain"
                />
              ) : (
                <p className="p-4 text-sm text-zinc-500">
                  {imgErr ?? "Loading image…"}
                </p>
              )}
            </div>
          )}

          <div className="mt-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Revision</h2>
              {!showRevForm && (
                <button
                  type="button"
                  onClick={() => setShowRevForm(true)}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Mark as Revised
                </button>
              )}
            </div>

            {!showRevForm ? (
              <p className="mt-2 text-sm text-zinc-500">
                Status: {REVISION_LABELS[question.revision_status]}
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-sm font-medium">How did you remember it?</p>
                <div className="flex gap-2">
                  {(["RECALLED", "PARTIAL", "FORGOTTEN"] as RevisionOutcome[]).map(
                    (o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setOutcome(o)}
                        className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium ${
                          outcome === o
                            ? "border-sky-600 bg-sky-600 text-white"
                            : "border-zinc-300 text-zinc-600 dark:border-zinc-700"
                        }`}
                      >
                        {REVISION_OUTCOME_LABELS[o]}
                      </button>
                    ),
                  )}
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-500">Revision notes (optional)</span>
                  <textarea
                    value={revNotes}
                    onChange={(e) => setRevNotes(e.target.value)}
                    rows={2}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                {revErr && (
                  <p className="text-sm text-red-600" role="alert">
                    {revErr}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveRevision}
                    disabled={!outcome || savingRev}
                    className="flex-1 rounded-lg bg-sky-600 px-3 py-2.5 font-semibold text-white disabled:opacity-60"
                  >
                    {savingRev ? "Saving…" : "Save Revision"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRevForm(false);
                      setOutcome(null);
                      setRevNotes("");
                      setRevErr(null);
                    }}
                    disabled={savingRev}
                    className="rounded-lg border border-zinc-300 px-3 py-2.5 font-medium dark:border-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <h3 className="mb-1 mt-4 text-sm font-semibold text-zinc-500">
              Revision History
            </h3>
            {revisions.length === 0 ? (
              <p className="text-sm text-zinc-500">Not revised yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {revisions.map((r) => (
                  <li key={r.id} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">
                        {new Date(r.revision_date).toLocaleDateString()}
                      </span>
                      <span className="text-zinc-500">
                        {r.outcome ? REVISION_OUTCOME_LABELS[r.outcome] : "—"}
                      </span>
                    </div>
                    {r.notes && (
                      <p className="mt-0.5 whitespace-pre-wrap text-zinc-500">
                        {r.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 font-semibold text-white"
            >
              Edit
            </button>
            <DeleteQuestionButton id={question.id} imagePath={question.image_path} />
          </div>
        </div>
      )}
    </main>
  );
}
