import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuestionsClient from "./questions-client";
import type { QuestionListItem, TopicOption } from "@/lib/questions";

export default async function QuestionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: questions } = await supabase
    .from("important_questions")
    .select(
      "id, question_name, subject, topic_id, priority, input_type, revision_status, created_at, topics(name)",
    )
    .order("created_at", { ascending: false });

  const { data: topics } = await supabase
    .from("topics")
    .select("id, subject, name")
    .eq("student_id", user.id);

  const list: QuestionListItem[] = (questions ?? []).map((q: Record<string, unknown>) => ({
    id: q.id as string,
    question_name: q.question_name as string,
    subject: q.subject as QuestionListItem["subject"],
    topicName: (q.topics as { name?: string } | null)?.name ?? null,
    priority: q.priority as QuestionListItem["priority"],
    input_type: q.input_type as QuestionListItem["input_type"],
    revision_status: q.revision_status as QuestionListItem["revision_status"],
    created_at: q.created_at as string,
  }));

  const topicOpts: TopicOption[] = (topics ?? []).map(
    (t: Record<string, unknown>) => ({
      id: t.id as string,
      subject: t.subject as TopicOption["subject"],
      name: t.name as string,
    }),
  );

  return <QuestionsClient questions={list} topics={topicOpts} userId={user.id} />;
}
