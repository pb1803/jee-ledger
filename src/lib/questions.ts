import type { Subject } from "./types";

export type InputType = "IMAGE" | "TEXT" | "URL";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type RevisionStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export interface TopicOption {
  id: string;
  subject: Subject;
  name: string;
}

export interface ImportantQuestion {
  id: string;
  question_name: string;
  subject: Subject;
  topic_id: string | null;
  source: string | null;
  priority: Priority;
  input_type: InputType;
  question_text: string | null;
  external_url: string | null;
  image_path: string | null;
  notes: string | null;
  revision_status: RevisionStatus;
  created_at: string;
}

export interface QuestionListItem {
  id: string;
  question_name: string;
  subject: Subject;
  topicName: string | null;
  priority: Priority;
  input_type: InputType;
  revision_status: RevisionStatus;
  created_at: string;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  IMAGE: "Image",
  TEXT: "Text",
  URL: "URL",
};

export const REVISION_LABELS: Record<RevisionStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
