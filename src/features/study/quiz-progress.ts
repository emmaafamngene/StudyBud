export const QUIZ_PROGRESS_STORAGE_KEY = "studybud.quiz-progress";

export interface QuizAttempt {
  documentId: string;
  score: number;
  total: number;
  completedAt: string;
}

function isQuizAttempt(value: unknown): value is QuizAttempt {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const attempt = value as Record<string, unknown>;
  return (
    typeof attempt.documentId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attempt.documentId) &&
    typeof attempt.score === "number" &&
    Number.isInteger(attempt.score) &&
    attempt.score >= 0 &&
    typeof attempt.total === "number" &&
    Number.isInteger(attempt.total) &&
    attempt.total > 0 &&
    attempt.score <= attempt.total &&
    typeof attempt.completedAt === "string" &&
    Number.isFinite(Date.parse(attempt.completedAt))
  );
}

export function readQuizAttempts(): QuizAttempt[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(QUIZ_PROGRESS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) {
      console.warn("Ignoring invalid locally stored quiz progress.");
      return [];
    }
    return value.filter(isQuizAttempt);
  } catch (error) {
    console.error("Unable to read locally stored quiz progress:", error);
    return [];
  }
}

export function saveQuizAttempt(attempt: QuizAttempt): void {
  const attempts = readQuizAttempts();
  localStorage.setItem(
    QUIZ_PROGRESS_STORAGE_KEY,
    JSON.stringify([attempt, ...attempts].slice(0, 200)),
  );
}
