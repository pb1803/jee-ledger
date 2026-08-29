"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteQuestionImage } from "@/lib/image";

export default function DeleteQuestionButton({
  id,
  imagePath = null,
  onDeleted,
}: {
  id: string;
  imagePath?: string | null;
  onDeleted?: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (
      !window.confirm("Delete this important question? This cannot be undone.")
    )
      return;
    setBusy(true);
    setError(null);
    try {
      // 1) Delete the database record first.
      const { error } = await supabase
        .from("important_questions")
        .delete()
        .eq("id", id);
      if (error) throw error;

      // 2) Best-effort removal of the Storage object (if any).
      if (imagePath) {
        try {
          await deleteQuestionImage(supabase, imagePath);
        } catch {
          setError(
            `Question deleted, but its image could not be removed from storage (orphan at ${imagePath}).`,
          );
          setBusy(false);
          return; // keep the user on the page so the orphan path is visible
        }
      }
      onDeleted?.();
      router.push("/questions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="rounded-lg border border-red-300 px-4 py-2.5 font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
