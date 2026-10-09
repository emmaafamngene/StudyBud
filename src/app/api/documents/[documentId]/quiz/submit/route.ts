import { NextResponse } from "next/server";
import type { QuizReviewItem } from "@/features/study/quiz-types";
import { readQuizToken } from "@/lib/ai/quiz-token";

interface SubmitQuizBody {
  token?: unknown;
  answers?: unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  let body: SubmitQuizBody;
  try {
    body = (await request.json()) as SubmitQuizBody;
  } catch {
    return NextResponse.json({ error: "Invalid quiz submission." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid quiz submission." }, { status: 400 });
  }

  if (
    typeof body.token !== "string" ||
    !Array.isArray(body.answers) ||
    body.answers.length !== 5 ||
    !body.answers.every(
      (answer) => Number.isInteger(answer) && answer >= 0 && answer < 4,
    )
  ) {
    return NextResponse.json(
      { error: "Answer all five questions before submitting your quiz." },
      { status: 400 },
    );
  }

  const { documentId } = await params;
  let questions;
  try {
    questions = readQuizToken(body.token, documentId);
  } catch {
    return NextResponse.json(
      { error: "This quiz has expired or is invalid. Generate a new quiz to continue." },
      { status: 400 },
    );
  }

  const answers = body.answers as number[];
  const review: QuizReviewItem[] = questions.map((question, index) => ({
    ...question,
    selectedIndex: answers[index],
  }));
  const score = review.reduce(
    (total, question) => total + Number(question.selectedIndex === question.correctIndex),
    0,
  );

  return NextResponse.json({
    score,
    total: questions.length,
    review,
  });
}
