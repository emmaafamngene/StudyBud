export type AppearancePreference = "system" | "light" | "dark";
export type ExplanationDifficulty = "simple" | "standard" | "advanced";
export type AnswerLength = "concise" | "balanced" | "detailed";
export type LearningStyle = "examples" | "step-by-step" | "analogies";

export interface StudyPreferences {
  appearance: AppearancePreference;
  difficulty: ExplanationDifficulty;
  answerLength: AnswerLength;
  learningStyle: LearningStyle;
}

export const PREFERENCES_STORAGE_KEY = "studybud.preferences";

export const DEFAULT_PREFERENCES: StudyPreferences = {
  appearance: "system",
  difficulty: "standard",
  answerLength: "balanced",
  learningStyle: "examples",
};

export function isStudyPreferences(value: unknown): value is StudyPreferences {
  if (typeof value !== "object" || value === null) return false;
  const preferences = value as Record<string, unknown>;
  return (
    (preferences.appearance === "system" ||
      preferences.appearance === "light" ||
      preferences.appearance === "dark") &&
    (preferences.difficulty === "simple" ||
      preferences.difficulty === "standard" ||
      preferences.difficulty === "advanced") &&
    (preferences.answerLength === "concise" ||
      preferences.answerLength === "balanced" ||
      preferences.answerLength === "detailed") &&
    (preferences.learningStyle === "examples" ||
      preferences.learningStyle === "step-by-step" ||
      preferences.learningStyle === "analogies")
  );
}

export function readStudyPreferences(): StudyPreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "null");
    return isStudyPreferences(value) ? value : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function applyAppearance(appearance: AppearancePreference): void {
  const prefersDark =
    appearance === "dark" ||
    (appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = prefersDark ? "dark" : "light";
  document.documentElement.style.colorScheme = prefersDark ? "dark" : "light";
}
