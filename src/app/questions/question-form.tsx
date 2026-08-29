"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/types";
import {
  PRIORITY_LABELS,
  REVISION_LABELS,
  isValidHttpUrl,
  type ImportantQuestion,
  type InputType,
  type Priority,
  type RevisionStatus,
  type TopicOption,
} from "@/lib/questions";
import {
  deleteQuestionImage,
  processImageFile,
  uploadQuestionImage,
} from "@/lib/image";
import { preprocessImageForOcr, recognizeText } from "@/lib/ocr";

const SUBJECTS: Subject[] = ["PHYSICS", "CHEMISTRY", "MATHEMATICS"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];
const REVISIONS: RevisionStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
];
const SOURCE_SUGGESTIONS = [
  "PYQ",
  "Coaching",
  "Module",
  "Mock Test",
  "Book",
  "Online",
  "Other",
];
const MAX_TEXT = 20000;

export default function QuestionForm({
  userId,
  topics,
  initial = null,
  onSaved,
  onCancel,
}: {
  userId: string;
  topics: TopicOption[];
  initial?: ImportantQuestion | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [questionName, setQuestionName] = useState(initial?.question_name ?? "");
  const [subject, setSubject] = useState<Subject>(initial?.subject ?? "PHYSICS");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    initial?.topic_id ?? null,
  );
  const [localTopics, setLocalTopics] = useState<TopicOption[]>(topics);
  const [newTopicName, setNewTopicName] = useState("");
  const [source, setSource] = useState(initial?.source ?? "");
  const [priority, setPriority] = useState<Priority>(
    initial?.priority ?? "MEDIUM",
  );
  const [inputType, setInputType] = useState<InputType>(
    initial?.input_type === "URL"
      ? "URL"
      : initial?.input_type === "IMAGE"
        ? "IMAGE"
        : "TEXT",
  );
  const [questionText, setQuestionText] = useState(
    initial?.question_text ?? "",
  );
  const [externalUrl, setExternalUrl] = useState(initial?.external_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [revisionStatus, setRevisionStatus] = useState<RevisionStatus>(
    initial?.revision_status ?? "NOT_STARTED",
  );

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // OCR (Scan & Extract Text) state. The source photo lives only in browser
  // memory and is never uploaded; the verified result is stored as TEXT.
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDuration, setOcrDuration] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const topicOptions = localTopics.filter((t) => t.subject === subject);

  async function handleAddTopic() {
    const name = newTopicName.trim();
    if (!name) return;
    const known = localTopics.find(
      (t) =>
        t.subject === subject && t.name.toLowerCase() === name.toLowerCase(),
    );
    if (known) {
      setSelectedTopicId(known.id);
      setNewTopicName("");
      return;
    }
    const supabase = createClient();
    const { data, error: insErr } = await supabase
      .from("topics")
      .insert({ student_id: userId, subject, name })
      .select("id, name")
      .single();
    if (insErr) {
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
          setLocalTopics((prev) =>
            prev.some((t) => t.id === existing.id)
              ? prev
              : [...prev, { id: existing.id, subject, name: existing.name }],
          );
          setSelectedTopicId(existing.id);
          setNewTopicName("");
          return;
        }
      }
      setError(`Could not add topic "${name}". ${insErr.message}`);
      return;
    }
    const id = data.id as string;
    setLocalTopics((prev) => [...prev, { id, subject, name }]);
    setSelectedTopicId(id);
    setNewTopicName("");
  }

  function chooseInputType(t: InputType) {
    setInputType(t);
    // Switching types clears the now-irrelevant payload so the DB CHECK stays valid.
    clearOcrPhoto();
    if (t === "TEXT") {
      setExternalUrl("");
      setImageFile(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    } else if (t === "URL") {
      setQuestionText("");
      setImageFile(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    } else {
      setQuestionText("");
      setExternalUrl("");
    }
  }

  function onOcrImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (ocrPreview) URL.revokeObjectURL(ocrPreview);
    setOcrFile(f);
    setOcrPreview(URL.createObjectURL(f));
    setOcrError(null);
    setOcrStatus(null);
    setOcrDuration(null);
  }

  function clearOcrPhoto() {
    if (ocrPreview) URL.revokeObjectURL(ocrPreview);
    setOcrFile(null);
    setOcrPreview(null);
    setOcrBusy(false);
    setOcrStatus(null);
    setOcrError(null);
    setOcrDuration(null);
  }

  async function runOcr() {
    if (!ocrFile) {
      setOcrError("Please choose a photo first.");
      return;
    }
    setOcrBusy(true);
    setOcrError(null);
    setOcrDuration(null);
    setOcrStatus("Preparing image…");
    try {
      const blob = await preprocessImageForOcr(ocrFile, {
        grayscale: true,
        contrast: true,
      });
      const { text, durationMs } = await recognizeText(blob, setOcrStatus);
      setQuestionText(text);
      setOcrDuration(durationMs);
      setOcrStatus(null);
    } catch (err) {
      setOcrError(
        err instanceof Error
          ? err.message
          : "Could not read the question. Try a clearer, well-lit photo.",
      );
      setOcrStatus(null);
    } finally {
      setOcrBusy(false);
    }
  }

  function onImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(f));
    setImageFile(f);
    setImageError(null);
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageFile(null);
    setImageError(null);
  }

  function validate(): string | null {
    if (!questionName.trim()) return "Question name is required.";
    if (!SUBJECTS.includes(subject)) return "Subject is required.";
    if (!selectedTopicId) return "Please select or add a topic.";
    if (inputType === "TEXT") {
      const t = questionText.trim();
      if (!t) return "Question text is required for Text questions.";
      if (t.length > MAX_TEXT)
        return `Question text is too long (max ${MAX_TEXT} characters).`;
    } else if (inputType === "URL") {
      if (!isValidHttpUrl(externalUrl.trim()))
        return "Enter a valid http(s) URL.";
    } else if (inputType === "IMAGE") {
      if (!imageFile && !initial?.image_path)
        return "Please choose an image.";
    } else {
      return "Unsupported input type.";
    }
    if (!PRIORITIES.includes(priority)) return "Invalid priority.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    setError(null);
    setImageError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const createId: string | undefined = initial?.id;
    const previousImagePath: string | null = initial?.image_path ?? null;
    let imagePath: string | null = null;
    let uploadedPath: string | null = null;

    try {
      if (inputType === "IMAGE") {
        if (imageFile) {
          setBusyStep("Preparing image…");
          const { blob } = await processImageFile(imageFile);
          setBusyStep("Uploading image…");
          const idForPath = createId ?? crypto.randomUUID();
          const fileName = createId
            ? `${createId}-${crypto.randomUUID()}.jpg`
            : `${idForPath}.jpg`;
          const path = `${userId}/${fileName}`;
          uploadedPath = await uploadQuestionImage(supabase, path, blob);
          imagePath = uploadedPath;
        } else if (previousImagePath) {
          imagePath = previousImagePath;
        } else {
          throw new Error("Please choose an image.");
        }
      }

      setBusyStep("Saving question…");
      const row: Record<string, unknown> = {
        student_id: userId,
        question_name: questionName.trim(),
        subject,
        topic_id: selectedTopicId,
        source: source.trim() || null,
        priority,
        input_type: inputType,
        question_text: inputType === "TEXT" ? questionText.trim() : null,
        external_url: inputType === "URL" ? externalUrl.trim() : null,
        image_path: inputType === "IMAGE" ? imagePath : null,
        notes: notes.trim() || null,
        revision_status: revisionStatus,
      };
      if (createId) row.id = createId;
      else if (inputType === "IMAGE" && imagePath) {
        // For a brand-new IMAGE question the id must match the uploaded path.
        row.id = imagePath.split("/")[1].replace(/\.jpg$/, "");
      }

      const { error } = await supabase
        .from("important_questions")
        .upsert(row, { onConflict: "id" });
      if (error) throw error;

      // Success: remove the old image only if it was replaced or converted away.
      if (previousImagePath && previousImagePath !== imagePath) {
        try {
          await deleteQuestionImage(supabase, previousImagePath);
        } catch {
          setError(
            `Question saved, but the previous image could not be deleted (orphan at ${previousImagePath}).`,
          );
        }
      }

      setSuccess(true);
      setBusyStep(null);
      onSaved?.();
    } catch (err) {
      // If we uploaded a fresh image but the DB write failed, clean it up.
      if (uploadedPath) {
        try {
          await deleteQuestionImage(supabase, uploadedPath);
        } catch {
          setError(
            `Save failed and cleanup of the uploaded image also failed. Orphan at ${uploadedPath}.`,
          );
          setSaving(false);
          setBusyStep(null);
          return;
        }
      }
      setError(err instanceof Error ? err.message : "Failed to save.");
      setBusyStep(null);
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Question name</span>
        <input
          type="text"
          value={questionName}
          onChange={(e) => setQuestionName(e.target.value)}
          placeholder="e.g. Capacitor combination trick"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Subject</span>
        <select
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value as Subject);
            setSelectedTopicId(null);
          }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s[0] + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Topic</span>
        <select
          value={selectedTopicId ?? ""}
          onChange={(e) => setSelectedTopicId(e.target.value || null)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="" disabled>
            Select topic…
          </option>
          {topicOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="Add new topic…"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleAddTopic}
            className="rounded-lg bg-zinc-200 px-3 py-2 text-sm font-medium dark:bg-zinc-800"
          >
            Add
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">
          Source (optional)
        </span>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. PYQ, Coaching, Book…"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {SOURCE_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-700"
            >
              {s}
            </button>
          ))}
        </div>
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Priority</span>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">
          How do you want to add it?
        </span>
        <div className="flex flex-col gap-2">
          {(
            [
              {
                type: "IMAGE" as InputType,
                title: "Add Image",
                desc: "For questions where the visual format matters.",
              },
              {
                type: "TEXT" as InputType,
                title: "Scan & Extract Text",
                desc: "For plain text questions.",
              },
              {
                type: "URL" as InputType,
                title: "Add URL",
                desc: "For questions available elsewhere online.",
              },
            ]
          ).map((m) => (
            <button
              key={m.type}
              type="button"
              onClick={() => chooseInputType(m.type)}
              className={`rounded-lg border px-3 py-2 text-left ${
                inputType === m.type
                  ? "border-sky-600 bg-sky-600 text-white"
                  : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              <span className="block text-sm font-medium">{m.title}</span>
              <span
                className={`block text-xs ${
                  inputType === m.type
                    ? "text-sky-100"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {m.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {inputType === "TEXT" && (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <span className="font-medium text-zinc-600 dark:text-zinc-300">
              Scan from a photo (optional)
            </span>
            {ocrPreview ? (
              <div className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ocrPreview}
                  alt="OCR source preview"
                  className="max-h-64 rounded-lg border object-contain dark:border-zinc-800"
                />
                {ocrBusy ? (
                  <p className="text-sm text-zinc-500">{ocrStatus}</p>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={runOcr}
                      disabled={ocrBusy}
                      className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Scan text
                    </button>
                    <button
                      type="button"
                      onClick={clearOcrPhoto}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
                    >
                      Remove photo
                    </button>
                  </div>
                )}
                {ocrError && (
                  <p className="text-sm text-red-600" role="alert">
                    {ocrError}
                  </p>
                )}
                {ocrDuration !== null && !ocrBusy && (
                  <p className="text-xs text-zinc-500">
                    OCR completed in {(ocrDuration / 1000).toFixed(1)} seconds
                  </p>
                )}
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onOcrImageSelected}
                className="text-sm"
              />
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">
              Question text
            </span>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={6}
              placeholder="Type, paste, or scan the question…"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Please check the extracted text before saving — mathematical symbols
            and diagrams may not be recognized correctly.
          </p>
        </div>
      )}

      {inputType === "URL" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Question URL</span>
          <input
            type="url"
            inputMode="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      )}

      {inputType === "IMAGE" && (
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Image</span>
          {imagePreview ? (
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Selected preview"
                className="max-h-64 rounded-lg border object-contain dark:border-zinc-800"
              />
              <button
                type="button"
                onClick={clearImage}
                className="self-start text-sm font-medium text-red-600"
              >
                Remove image
              </button>
            </div>
          ) : initial?.image_path ? (
            <p className="text-sm text-zinc-500">
              Current image is kept. Choose a new file to replace it.
            </p>
          ) : null}
          <input
            type="file"
            accept="image/*"
            onChange={onImageSelected}
            className="text-sm"
          />
          {imageError && <p className="text-sm text-red-600">{imageError}</p>}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">Revision status</span>
        <select
          value={revisionStatus}
          onChange={(e) => setRevisionStatus(e.target.value as RevisionStatus)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {REVISIONS.map((r) => (
            <option key={r} value={r}>
              {REVISION_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {busyStep ? "Saving…" : "Question saved."}
        </p>
      )}
      {busyStep && !success && (
        <p className="text-sm text-zinc-500">{busyStep}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-sky-600 px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Save question"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-zinc-300 px-4 py-3 font-medium dark:border-zinc-700"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
