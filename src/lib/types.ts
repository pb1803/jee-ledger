export type Subject = "PHYSICS" | "CHEMISTRY" | "MATHEMATICS";

export type ExamTarget = "JEE_MAIN" | "JEE_ADV" | "MHT_CET";

export type InputType = "IMAGE" | "TEXT" | "URL";

export type RevisionStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  grade: number | null;
  exam_targets: ExamTarget[];
  timezone: string;
  created_at: string;
  updated_at: string;
}
