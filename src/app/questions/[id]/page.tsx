import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuestionDetail from "../question-detail";
import { fetchRevisions, type RevisionRecord } from "@/lib/revisions";
import type { ImportantQuestion, TopicOption } from "@/lib/questions";

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: q } = await supabase
    .from("important_questions")
    .select("*, topics(name)")
    .eq("id", id)
    .maybeSingle();

  if (!q) notFound();

  const { data: topics } = await supabase
    .from("topics")
    .select("id, subject, name")
    .eq("student_id", user.id);

  let revisions: RevisionRecord[] = [];
  try {
    revisions = await fetchRevisions(supabase, id);
  } catch {
    revisions = [];
  }

  const question: ImportantQuestion = {
    id: q.id,
    question_name: q.question_name,
    subject: q.subject,
    topic_id: q.topic_id ?? null,
    source: q.source ?? null,
    priority: q.priority,
    input_type: q.input_type,
    question_text: q.question_text ?? null,
    external_url: q.external_url ?? null,
    image_path: q.image_path ?? null,
    notes: q.notes ?? null,
    revision_status: q.revision_status,
    created_at: q.created_at,
  };

  const topicName = (q.topics as { name?: string } | null)?.name ?? null;
  const topicOpts: TopicOption[] = (topics ?? []).map(
    (t: Record<string, unknown>) => ({
      id: t.id as string,
      subject: t.subject as TopicOption["subject"],
      name: t.name as string,
    }),
  );

  return (
    <QuestionDetail
      question={question}
      topicName={topicName}
      topics={topicOpts}
      userId={user.id}
      revisions={revisions}
    />
  );
}
