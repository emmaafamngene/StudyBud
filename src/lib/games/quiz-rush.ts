import "server-only";
import type { QuizAnswer } from "@/features/study/quiz-types";
import { publicQuizQuestions } from "@/lib/ai/quiz";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const QUIZ_RUSH_QUESTION_COUNT = 10;
export const QUIZ_RUSH_LIFETIME_MS = 60 * 60 * 1000;

export interface QuizRushResponse {
  selectedIndex: number;
  correctIndex: number;
  points: number;
  xp: number;
}

export interface QuizRushSession {
  id: string;
  document_id: string;
  questions: QuizAnswer[];
  responses: QuizRushResponse[];
  answered_count: number;
  score: number;
  streak: number;
  best_streak: number;
  xp: number;
  expires_at: string;
  completed_at: string | null;
}

export async function getQuizRushSession(id: string): Promise<QuizRushSession | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("quiz_rush_sessions")
    .select(
      "id, document_id, questions, responses, answered_count, score, streak, best_streak, xp, expires_at, completed_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load Quiz Rush session: ${error.message}`);
  return data as QuizRushSession | null;
}

export async function insertQuizRushSession(input: {
  id: string;
  documentId: string;
  questions: QuizAnswer[];
  expiresAt: string;
}): Promise<void> {
  const { error } = await getSupabaseAdmin().from("quiz_rush_sessions").insert({
    id: input.id,
    document_id: input.documentId,
    questions: input.questions,
    expires_at: input.expiresAt,
  });

  if (error) throw new Error(`Unable to create Quiz Rush session: ${error.message}`);
}

export async function advanceQuizRushSession(
  session: QuizRushSession,
  responses: QuizRushResponse[],
  score: number,
  streak: number,
  bestStreak: number,
  xp: number,
  isComplete: boolean,
): Promise<QuizRushSession | null> {
  const nextAnsweredCount = session.answered_count + 1;
  const { data, error } = await getSupabaseAdmin()
    .from("quiz_rush_sessions")
    .update({
      responses,
      answered_count: nextAnsweredCount,
      score,
      streak,
      best_streak: bestStreak,
      xp,
      completed_at: isComplete ? new Date().toISOString() : null,
    })
    .eq("id", session.id)
    .eq("answered_count", session.answered_count)
    .is("completed_at", null)
    .select(
      "id, document_id, questions, responses, answered_count, score, streak, best_streak, xp, expires_at, completed_at",
    )
    .maybeSingle();

  if (error) throw new Error(`Unable to score Quiz Rush answer: ${error.message}`);
  return data as QuizRushSession | null;
}
