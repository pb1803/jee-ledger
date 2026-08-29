"use client";

import { useState } from "react";
import { preprocessImageForOcr, recognizeText } from "@/lib/ocr";

export default function OcrTestPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [grayscale, setGrayscale] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setText("");
    setDuration(null);
    setError(null);
    setStatus(null);
    setCopied(false);
  }

  function reset() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setText("");
    setDuration(null);
    setStatus(null);
    setError(null);
    setCopied(false);
    setBusy(false);
  }

  async function onExtract() {
    if (!imageFile) {
      setError("Please choose an image first.");
      return;
    }
    setBusy(true);
    setError(null);
    setCopied(false);
    setStatus("Preparing image…");
    try {
      const blob = await preprocessImageForOcr(imageFile, {
        grayscale,
        contrast,
      });
      const { text: ocrText, durationMs } = await recognizeText(
        blob,
        setStatus,
      );
      setText(ocrText);
      setDuration(durationMs);
      setStatus(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "OCR failed. Try a clearer, well-lit photo.",
      );
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-1 text-xl font-bold">OCR Test (Prototype)</h1>
      <p className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
        This runs entirely in your browser using an open-source OCR engine. It is
        for <strong>printed normal English text, numbers, and units</strong>.
        It will <strong>NOT</strong> reliably read math notation, integrals,
        Greek letters, fractions, chemical diagrams, or handwritten text. It does
        not understand diagrams at all. Use it to evaluate quality only.
      </p>

      {/* Step 1: select image */}
      <section className="mb-4">
        <label className="mb-2 block font-medium">
          Step 1 — Select Question Image
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onSelect}
          className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-white"
        />
      </section>

      {/* Step 2: preview */}
      {imagePreview && (
        <section className="mb-4">
          <p className="mb-2 font-medium">Step 2 — Preview</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Selected question"
            className="max-h-72 w-full rounded border object-contain"
          />
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={grayscale}
                onChange={(e) => setGrayscale(e.target.checked)}
              />
              Grayscale
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={contrast}
                onChange={(e) => setContrast(e.target.checked)}
              />
              Contrast boost
            </label>
          </div>
        </section>
      )}

      {/* Step 3: extract */}
      <section className="mb-4">
        <button
          type="button"
          onClick={onExtract}
          disabled={busy || !imageFile}
          className="rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Extract Text"}
        </button>
        {status && (
          <p className="mt-2 text-sm text-slate-600" aria-live="polite">
            {status}
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* Step 4: result */}
      {text !== "" && (
        <section className="mb-4">
          <p className="mb-2 font-medium">Step 4 — Extracted Text (editable)</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="w-full rounded border p-2 font-mono text-sm"
            placeholder="OCR result will appear here. Correct it manually."
          />
          {duration !== null && (
            <p className="mt-1 text-xs text-slate-500">
              OCR completed in {(duration / 1000).toFixed(1)} seconds
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={copyText}
              className="rounded bg-emerald-700 px-3 py-2 text-sm text-white"
            >
              {copied ? "Copied!" : "Copy / Use Text"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded border px-3 py-2 text-sm"
            >
              Reset
            </button>
          </div>
        </section>
      )}

      {!imageFile && !busy && (
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded border px-3 py-2 text-sm"
        >
          Reset
        </button>
      )}
    </main>
  );
}
