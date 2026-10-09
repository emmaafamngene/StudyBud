export const DOCUMENT_SUBJECTS = [
  "Physics",
  "Mathematics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Other",
] as const;

export type DocumentSubject = (typeof DOCUMENT_SUBJECTS)[number];

export function isDocumentSubject(value: unknown): value is DocumentSubject {
  return DOCUMENT_SUBJECTS.some((subject) => subject === value);
}

export interface DocumentSummary {
  id: string;
  filename: string;
  storage_path: string;
  created_at: string;
  subject: DocumentSubject | null;
  file_size_bytes: number | null;
}
