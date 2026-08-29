import type { SupabaseClient } from "@supabase/supabase-js";
import {
  revisionOutcomeToStatus,
  type RevisionOutcome,
  type RevisionStatus,
} from "./questions";

export interface RevisionRecord {
  id: string;
  revision_date: string;
  outcome: RevisionOutcome | null;
  notes: string | null;
  created_at: string;
}

// Keep newest-first (by date, then insert time) for history display.
export async function fetchRevisions(
  supabase: SupabaseClient,
  questionId: string,
): Promise<RevisionRecord[]> {
  const { data, error } = await supabase
    .from("revisions")
    .select("id, revision_date, outcome, notes, created_at")
    .eq("question_id", questionId)
    .order("revision_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    revision_date: r.revision_date as string,
    outcome: (r.outcome as RevisionOutcome | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}

// Append-only: insert a new revision row, then reflect its outcome on the
// question's revision_status. RLS enforces ownership of both tables.
export async function recordRevision(
  supabase: SupabaseClient,
  questionId: string,
  outcome: RevisionOutcome,
  notes?: string,
): Promise<void> {
  const cleanNotes = notes?.trim() || null;

  const { error: insErr } = await supabase
    .from("revisions")
    .insert({ question_id: questionId, outcome, notes: cleanNotes });
  if (insErr) throw insErr;

  const next: RevisionStatus = revisionOutcomeToStatus(outcome);
  const { error: updErr } = await supabase
    .from("important_questions")
    .update({ revision_status: next })
    .eq("id", questionId);
  if (updErr) throw updErr;
}
