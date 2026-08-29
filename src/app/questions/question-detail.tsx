"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import QuestionForm from "./question-form";
import DeleteQuestionButton from "./delete-question-button";
import { getSignedImageUrl } from "@/lib/image";
import { prettySubject } from "@/lib/study";
import {
  INPUT_TYPE_LABELS,
  PRIORITY_LABELS,
  REVISION_LABELS,
  type ImportantQuestion,
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
}: {
  question: ImportantQuestion;
  topicName: string | null;
  topics: TopicOption[];
  userId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);

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
