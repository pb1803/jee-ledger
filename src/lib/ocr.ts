// Isolated, client-side OCR utilities for the /ocr-test prototype.
//
// IMPORTANT: This module is intentionally separate from the Important Questions
// workflow. It validates OCR quality only — it does NOT save anything to Supabase.
//
// OCR runs entirely in the browser via tesseract.js (open-source, no paid API).
// tesseract.js is lazily imported inside `recognizeText` so it is NOT bundled into
// normal application routes.

export interface OcrPreprocessOptions {
  grayscale?: boolean;
  contrast?: boolean;
  maxDim?: number;
}

// Loads an image file, resizes it (cheap preprocessing), and optionally applies
// grayscale / contrast filters. Returns a PNG Blob suitable for OCR. The original
// file never leaves the browser.
export async function preprocessImageForOcr(
  file: File,
  opts: OcrPreprocessOptions = {},
): Promise<Blob> {
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Unsupported file. Please choose an image.");
  }

  const maxDim = opts.maxDim ?? 1280;
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");

  const filters: string[] = [];
  if (opts.grayscale) filters.push("grayscale(1)");
  if (opts.contrast) filters.push("contrast(1.25)");
  if (filters.length) ctx.filter = filters.join(" ");

  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  ctx.filter = "none";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob || blob.size === 0) {
    throw new Error("Image preprocessing failed (empty output).");
  }
  return blob;
}

export interface OcrResult {
  text: string;
  durationMs: number;
}

// Lazily loads tesseract.js and runs OCR on the provided image Blob.
// A status callback keeps the UI informed so it never freezes silently.
export async function recognizeText(
  image: Blob,
  onStatus?: (msg: string) => void,
): Promise<OcrResult> {
  onStatus?.("Loading OCR engine…");
  const Tesseract = await import("tesseract.js");

  onStatus?.("Running OCR…");
  const start = performance.now();

  const result = await Tesseract.recognize(image, "eng", {
    logger: (m: { status?: string }) => {
      if (m?.status === "recognizing text") onStatus?.("Almost done…");
    },
  });

  const durationMs = Math.round(performance.now() - start);
  const text: string = result.data?.text ?? "";
  return { text, durationMs };
}
