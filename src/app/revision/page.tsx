import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RevisionClient from "./revision-client";
import type { QuestionListItem, RevisionStatus } from "@/lib/questions";
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

export default async function RevisionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: questions } = await supabase
    .from("important_questions")
    .select(
      "id, question_name, subject, topic_id, priority, revision_status, created_at, topics(name), revisions(revision_date)",
    )
    .order("created_at", { ascending: false });

  const items: QueueRow[] = (questions ?? []).map((q: Record<string, unknown>) => {
    const revs = (q.revisions as { revision_date?: string }[] | null) ?? [];
    let last: string | null = null;
    for (const r of revs) {
      if (r.revision_date && (last === null || r.revision_date > last)) {
        last = r.revision_date;
      }
    }
    return {
      id: q.id as string,
      question_name: q.question_name as string,
      subject: q.subject as Subject,
      topicName: (q.topics as { name?: string } | null)?.name ?? null,
      priority: q.priority as QuestionListItem["priority"],
      revision_status: q.revision_status as RevisionStatus,
      lastRevisionDate: last,
    };
  });

  return <RevisionClient items={items} />;
}
