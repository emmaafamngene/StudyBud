import { NextResponse } from "next/server";
import { getDocument } from "@/lib/documents/repository";
import { answerFromDocument, AIProviderError } from "@/lib/ai/gemini";
import type { ChatMessage } from "@/features/study/types";
import { isStudyPreferences } from "@/features/settings/preferences";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_MESSAGE_LENGTH = 2000;

interface ChatRequestBody {
  question?: unknown;
  history?: unknown;
  preferences?: unknown;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= MAX_HISTORY_MESSAGE_LENGTH
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  if (
    typeof body.question !== "string" ||
    body.question.trim().length === 0 ||
    body.question.length > MAX_QUESTION_LENGTH
  ) {
    return NextResponse.json(
      { error: "Enter a question of up to 2,000 characters." },
      { status: 400 },
    );
  }

  const history = body.history ?? [];
  if (
    !Array.isArray(history) ||
    history.length > MAX_HISTORY_MESSAGES ||
    !history.every(isChatMessage)
  ) {
    return NextResponse.json(
      { error: "The chat history is invalid. Start a new question and try again." },
      { status: 400 },
    );
  }

  const preferences = body.preferences;
  if (preferences !== undefined && !isStudyPreferences(preferences)) {
    return NextResponse.json({ error: "The study preferences are invalid." }, { status: 400 });
  }

  const { documentId } = await params;
  let document;
  try {
    document = await getDocument(documentId);
  } catch (error) {
    console.error("Unable to load document for chat:", error);
    return NextResponse.json(
      { error: "Unable to load this document. Please try again." },
      { status: 503 },
    );
  }

  if (!document) {
    return NextResponse.json({ error: "This study document could not be found." }, { status: 404 });
  }

  try {
    const answer = await answerFromDocument(
      document.extracted_text,
      history,
      body.question.trim(),
      preferences,
    );
    return NextResponse.json({ answer });
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Unexpected error while answering document question:", error);
    return NextResponse.json(
      { error: "StudyBud could not answer just now. Please try again." },
      { status: 500 },
    );
  }
}
