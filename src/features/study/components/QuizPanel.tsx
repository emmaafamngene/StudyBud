"use client";

import { useState } from "react";
import type { GeneratedQuiz, QuizQuestion, QuizReviewItem } from "@/features/study/quiz-types";
import { saveQuizAttempt } from "@/features/study/quiz-progress";

interface QuizPanelProps {
  documentId: string;
}

interface QuizResult {
  score: number;
  total: number;
  review: QuizReviewItem[];
}

export default function QuizPanel({ documentId }: QuizPanelProps) {
  const [quiz, setQuiz] = useState<GeneratedQuiz | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);

  async function generateQuiz() {
    setIsGenerating(true);
    setError(null);
    setQuiz(null);
    setAnswers([]);
    setResult(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/quiz`, { method: "POST" });
      const generated = (await response.json()) as GeneratedQuiz & { error?: string };
      if (
        !response.ok ||
        !generated.token ||
        !Array.isArray(generated.questions) ||
        generated.questions.length !== 5
      ) {
        throw new Error(generated.error ?? "StudyBud couldn't create a valid quiz.");
      }

      setQuiz(generated);
      setAnswers(Array(generated.questions.length).fill(-1));
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "StudyBud couldn't generate the quiz. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function chooseAnswer(questionIndex: number, optionIndex: number) {
    setAnswers((current) =>
      current.map((answer, index) => (index === questionIndex ? optionIndex : answer)),
    );
  }

  async function submitQuiz() {
    if (!quiz || answers.some((answer) => answer < 0) || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: quiz.token, answers }),
      });
      const submitted = (await response.json()) as QuizResult & { error?: string };
      if (!response.ok || !Array.isArray(submitted.review)) {
        throw new Error(submitted.error ?? "Your quiz could not be scored. Please try again.");
      }
      setResult(submitted);
      try {
        saveQuizAttempt({
          documentId,
          score: submitted.score,
          total: submitted.total,
          completedAt: new Date().toISOString(),
        });
        setProgressWarning(null);
      } catch (saveError) {
        console.error("Unable to save completed quiz progress:", saveError);
        setProgressWarning(
          "Your score is shown below, but this device couldn't save it for dashboard progress.",
        );
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your quiz could not be scored. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M7 4.5h10A2.5 2.5 0 0 1 19.5 7v10a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.7" />
              <path d="m8 12.2 2.3 2.3 5.7-5.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-amber-700">
              Check your understanding
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-950">Practice quiz</h2>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Five questions, made from these notes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={generateQuiz}
          disabled={isGenerating || isSubmitting}
          className="min-h-10 shrink-0 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 sm:px-4 sm:text-sm"
        >
          {isGenerating ? "Generating quiz..." : result ? "Try another quiz" : "Generate Quiz"}
        </button>
      </div>

      {isGenerating && (
        <p role="status" className="mx-4 mt-4 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-800 sm:mx-5">
          StudyBud is preparing five questions from your notes...
        </p>
      )}
      {error && (
        <p role="alert" className="mx-4 mt-4 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700 sm:mx-5">
          {error}
        </p>
      )}
      {progressWarning && (
        <p role="status" className="mx-4 mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900 sm:mx-5">
          {progressWarning}
        </p>
      )}

      {quiz && !result && (
        <div className="space-y-4 px-4 py-5 sm:px-5">
          {(quiz.questions as QuizQuestion[]).map((question, questionIndex) => (
            <fieldset
              key={`${questionIndex}-${question.question}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-100"
            >
              <legend className="px-1 text-sm font-semibold leading-6 text-slate-900">
                {questionIndex + 1}. {question.question}
              </legend>
              <div className="mt-3 grid gap-2">
                {question.options.map((option, optionIndex) => (
                  <label
                    key={`${optionIndex}-${option}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-xs leading-5 transition sm:text-sm ${
                      answers[questionIndex] === optionIndex
                        ? "border-indigo-400 bg-indigo-50 text-indigo-950"
                        : "border-slate-200 text-slate-700 hover:border-indigo-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`quiz-question-${questionIndex}`}
                      value={optionIndex}
                      checked={answers[questionIndex] === optionIndex}
                      onChange={() => chooseAnswer(questionIndex, optionIndex)}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-slate-500">
              {answers.filter((answer) => answer >= 0).length} of {quiz.questions.length} answered
            </p>
            <button
              type="button"
              onClick={submitQuiz}
              disabled={answers.some((answer) => answer < 0) || isSubmitting}
              className="min-h-11 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isSubmitting ? "Scoring quiz..." : "Submit quiz"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4 px-4 py-5 sm:px-5">
          <p
            role="status"
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-4 text-base font-bold text-white shadow-sm shadow-indigo-100"
          >
            Your score: {result.score} / {result.total}
          </p>
          {result.review.map((item, index) => {
            const isCorrect = item.correctIndex === item.selectedIndex;
            return (
              <article
                key={`${index}-${item.question}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              >
                <h3 className="text-sm font-semibold leading-6 text-slate-900">
                  {index + 1}. {item.question}
                </h3>
                <p
                  className={`mt-2 text-sm font-semibold ${
                    isCorrect ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {isCorrect ? "Correct" : "Not quite"}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  <span className="font-medium">Correct answer:</span>{" "}
                  {item.options[item.correctIndex]}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.explanation}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
