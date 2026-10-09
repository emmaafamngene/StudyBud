import { NextResponse } from "next/server";
import {
  advanceQuizRushSession,
  getQuizRushSession,
  type QuizRushResponse,
} from "@/lib/games/quiz-rush";

interface AnswerBody {
  questionIndex?: unknown;
  selectedIndex?: unknown;
}

function buildAnswerResult(
  response: QuizRushResponse,
  session: NonNullable<Awaited<ReturnType<typeof getQuizRushSession>>>,
  questionIndex: number,
) {
  const question = session.questions[questionIndex];
  const questionCount = session.questions.length;
  const isComplete = session.answered_count === questionCount;
  const result: Record<string, unknown> = {
    questionIndex,
    selectedIndex: response.selectedIndex,
    isCorrect: response.selectedIndex === response.correctIndex,
    correctAnswer: question.options[response.correctIndex],
    explanation: question.explanation,
    pointsEarned: response.points,
    streak: session.streak,
    bestStreak: session.best_streak,
    score: session.score,
    xp: session.xp,
    isComplete,
  };

  if (isComplete) {
    const correctCount = session.responses.filter(
      (answer) => answer.selectedIndex === answer.correctIndex,
    ).length;
    result.results = {
      score: session.score,
      correctCount,
      total: questionCount,
      accuracy: Math.round((correctCount / questionCount) * 100),
      bestStreak: session.best_streak,
      xp: session.xp,
      review: session.questions.map((item, index) => ({
        question: item.question,
        options: item.options,
        correctIndex: session.responses[index].correctIndex,
        selectedIndex: session.responses[index].selectedIndex,
        explanation: item.explanation,
      })),
      topicsToReview: session.questions
        .filter((_, index) => session.responses[index].selectedIndex !== session.responses[index].correctIndex)
        .map((item) => item.question),
    };
  }

  return result;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(sessionId)) {
    return NextResponse.json({ error: "This Quiz Rush session is invalid." }, { status: 400 });
  }

  let body: AnswerBody;
  try {
    body = (await request.json()) as AnswerBody;
  } catch {
    return NextResponse.json({ error: "Choose an answer to continue." }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !Number.isInteger(body.questionIndex) ||
    !Number.isInteger(body.selectedIndex) ||
    (body.selectedIndex as number) < 0 ||
    (body.selectedIndex as number) > 3
  ) {
    return NextResponse.json({ error: "That answer is not valid. Please choose an option." }, { status: 400 });
  }

  const questionIndex = body.questionIndex as number;
  const selectedIndex = body.selectedIndex as number;
  try {
    const session = await getQuizRushSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "This game session could not be found. Start a new game." }, { status: 404 });
    }
    if (questionIndex < 0 || questionIndex >= session.questions.length) {
      return NextResponse.json({ error: "That question is not part of this game." }, { status: 400 });
    }
    if (Date.parse(session.expires_at) <= Date.now()) {
      return NextResponse.json({ error: "This game session has expired. Start a new Quiz Rush." }, { status: 410 });
    }

    if (questionIndex < session.answered_count) {
      const previousResponse = session.responses[questionIndex];
      if (previousResponse?.selectedIndex === selectedIndex) {
        return NextResponse.json(buildAnswerResult(previousResponse, session, questionIndex));
      }
      return NextResponse.json(
        { error: "That question has already been answered. Continue to the next question." },
        { status: 409 },
      );
    }
    if (session.completed_at || questionIndex !== session.answered_count) {
      return NextResponse.json(
        { error: "Answer the current question before moving on." },
        { status: 409 },
      );
    }

    const question = session.questions[questionIndex];
    if (!question || !Array.isArray(question.options) || question.options.length !== 4) {
      console.error("Quiz Rush session contains an invalid question:", sessionId, questionIndex);
      return NextResponse.json({ error: "This game question could not be scored. Start a new game." }, { status: 500 });
    }

    const correctIndex = question.correctIndex;
    const isCorrect = selectedIndex === correctIndex;
    const streak = isCorrect ? session.streak + 1 : 0;
    const pointsEarned = isCorrect ? 100 + Math.min(50, Math.max(0, streak - 1) * 10) : 0;
    const xpEarned = isCorrect ? 10 + (streak >= 3 ? 2 : 0) : 0;
    const response: QuizRushResponse = {
      selectedIndex,
      correctIndex,
      points: pointsEarned,
      xp: xpEarned,
    };
    const responses = [...session.responses, response];
    const isComplete = responses.length === session.questions.length;
    const advanced = await advanceQuizRushSession(
      session,
      responses,
      session.score + pointsEarned,
      streak,
      Math.max(session.best_streak, streak),
      session.xp + xpEarned,
      isComplete,
    );

    if (!advanced) {
      const latest = await getQuizRushSession(sessionId);
      const latestResponse = latest?.responses[questionIndex];
      if (latest && latestResponse?.selectedIndex === selectedIndex) {
        return NextResponse.json(buildAnswerResult(latestResponse, latest, questionIndex));
      }
      return NextResponse.json(
        { error: "This answer was already submitted. Continue with the next question." },
        { status: 409 },
      );
    }

    return NextResponse.json(buildAnswerResult(response, advanced, questionIndex));
  } catch (error) {
    console.error("Unable to submit Quiz Rush answer:", error);
    return NextResponse.json({ error: "Your answer could not be scored. Please try again." }, { status: 503 });
  }
}
