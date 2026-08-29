import type { SupabaseClient } from "@supabase/supabase-js";

// Free-tier aware limits. We minimize storage footprint by resizing/compressing
// on the device before upload (no cloud-to-local migration, no auto-deletion).
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024; // reject absurd originals
export const MAX_DIMENSION = 1280; // longest side; keeps diagrams/notation legible
export const JPEG_QUALITY = 0.82; // balance size vs readability of math notation
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Reads the file, draws it (scaled) to a canvas, and exports a compact JPEG.
// Returns the blob plus the extension we persist (always "jpg" for the bucket).
export async function processImageFile(
  file: File,
): Promise<{ blob: Blob; ext: string }> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Unsupported image type. Use JPG, PNG, or WEBP.");
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error("Image is too large (max 15 MB before processing).");
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob || blob.size === 0) {
    throw new Error("Image processing produced an empty file.");
  }
  return { blob, ext: "jpg" };
}

export async function uploadQuestionImage(
  supabase: SupabaseClient,
  path: string,
  blob: Blob,
): Promise<string> {
  const { error } = await supabase.storage
    .from("question-images")
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });
  if (error) throw error;
  return path;
}

export async function deleteQuestionImage(
  supabase: SupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from("question-images")
    .remove([path]);
  if (error) throw error;
}

// Private bucket -> use a short-lived signed URL (never store a public URL in DB).
export async function getSignedImageUrl(
  supabase: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("question-images")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
