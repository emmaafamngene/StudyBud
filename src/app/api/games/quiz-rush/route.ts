import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { QuizAnswer } from "@/features/study/quiz-types";
import { AIProviderError } from "@/lib/ai/gemini";
import {
  generateDocumentQuiz,
  generateDocumentQuizFromPdf,
  publicQuizQuestions,
} from "@/lib/ai/quiz";
import { normalizeExtractedText } from "@/lib/documents/extracted-text";
import { getDocument } from "@/lib/documents/repository";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  insertQuizRushSession,
  QUIZ_RUSH_LIFETIME_MS,
  QUIZ_RUSH_QUESTION_COUNT,
} from "@/lib/games/quiz-rush";

export const runtime = "nodejs";
export const maxDuration = 60;

const MINIMUM_WORD_COUNT = 8;

export async function POST(request: Request) {
  let body: { documentId?: unknown };
  try {
    body = (await request.json()) as { documentId?: unknown };
  } catch {
    return NextResponse.json({ error: "Choose a study document to start Quiz Rush." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    typeof body.documentId !== "string"
  ) {
    return NextResponse.json({ error: "Choose a study document to start Quiz Rush." }, { status: 400 });
  }

  let document;
  try {
    document = await getDocument(body.documentId);
  } catch (error) {
    console.error("Unable to load document for Quiz Rush:", error);
    return NextResponse.json({ error: "Unable to load these notes. Please try again." }, { status: 503 });
  }
  if (!document) {
    return NextResponse.json({ error: "That study document could not be found." }, { status: 404 });
  }

  const extractedText = normalizeExtractedText(document.extracted_text);
  const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

  try {
    let questions: QuizAnswer[] = [];
    if (wordCount >= MINIMUM_WORD_COUNT) {
      questions = await generateDocumentQuiz(
        extractedText,
        QUIZ_RUSH_QUESTION_COUNT,
        { allowFewerQuestions: true },
      );
    }

    if (questions.length < 3) {
      const { data: file, error: downloadError } = await getSupabaseAdmin()
        .storage.from("documents")
        .download(document.storage_path);
      if (downloadError) {
        console.error("Unable to download source PDF for Quiz Rush:", downloadError);
        return NextResponse.json(
          { error: "StudyBud could not open this PDF. Try uploading the document again." },
          { status: 422 },
        );
      }

      const pdf = Buffer.from(await file.arrayBuffer());
      for (const questionCount of [QUIZ_RUSH_QUESTION_COUNT, 5, 3]) {
        try {
          questions = await generateDocumentQuizFromPdf(pdf, questionCount);
          if (questions.length >= 3) break;
        } catch (error) {
          const canRetryWithFewerQuestions =
            questionCount > 3 &&
            error instanceof AIProviderError &&
            error.status === 502 &&
            /valid \d+-question quiz|unreadable quiz/i.test(error.message);
          if (!canRetryWithFewerQuestions) throw error;
          console.warn(
            `Retrying PDF quiz generation with fewer questions after invalid ${questionCount}-question response.`,
          );
        }
      }
    }

    if (questions.length < 3) {
      return NextResponse.json(
        {
          error:
            "StudyBud couldn't find enough clear, answerable material in this PDF to make at least three questions. Try a fuller or clearer document.",
        },
        { status: 422 },
      );
    }

    const sessionId = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + QUIZ_RUSH_LIFETIME_MS).toISOString();
    await insertQuizRushSession({
      id: sessionId,
      documentId: document.id,
      questions,
      expiresAt,
    });

    return NextResponse.json({
      sessionId,
      expiresAt,
      questions: publicQuizQuestions(questions),
    });
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Unable to start Quiz Rush:", error);
    if (
      error instanceof Error &&
      /quiz_rush_sessions|schema cache/i.test(error.message)
    ) {
      return NextResponse.json(
        {
          error:
            "Quiz Rush is not enabled in this Supabase project yet. Apply supabase/migrations/20261009110000_create_quiz_rush_sessions.sql, then try again.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Quiz Rush could not start. Please try again." },
      { status: 503 },
    );
  }
}
