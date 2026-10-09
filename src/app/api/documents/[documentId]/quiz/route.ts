import { NextResponse } from "next/server";
import { AIProviderError } from "@/lib/ai/gemini";
import { generateDocumentQuiz, publicQuizQuestions } from "@/lib/ai/quiz";
import { createQuizToken } from "@/lib/ai/quiz-token";
import { getDocument } from "@/lib/documents/repository";
import { normalizeExtractedText } from "@/lib/documents/extracted-text";

export const runtime = "nodejs";
export const maxDuration = 60;

const MINIMUM_WORD_COUNT = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  let document;

  try {
    document = await getDocument(documentId);
  } catch (error) {
    console.error("Unable to load document for quiz generation:", error);
    return NextResponse.json(
      { error: "Unable to load this document. Please try again." },
      { status: 503 },
    );
  }

  if (!document) {
    return NextResponse.json({ error: "This study document could not be found." }, { status: 404 });
  }

  const extractedText = normalizeExtractedText(document.extracted_text);
  if (extractedText.split(/\s+/).filter(Boolean).length < MINIMUM_WORD_COUNT) {
    return NextResponse.json(
      {
        error:
          "This document does not contain enough readable notes to make a reliable five-question quiz. Try a document with more text.",
      },
      { status: 422 },
    );
  }

  try {
    const questions = await generateDocumentQuiz(extractedText);
    if (questions.length !== 5) {
      return NextResponse.json(
        {
          error:
            "There isn't enough distinct information in this document for five reliable questions. Try a more detailed document.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      token: createQuizToken(document.id, questions),
      questions: publicQuizQuestions(questions),
    });
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Unexpected error while generating quiz:", error);
    return NextResponse.json(
      { error: "StudyBud couldn't generate the quiz. Please try again." },
      { status: 500 },
    );
  }
}
