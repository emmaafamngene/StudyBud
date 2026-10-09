"use client";

import { useEffect, useState } from "react";
import { awardArenaXp, readArenaXp } from "@/features/games/progress";
import type { QuizQuestion } from "@/features/study/quiz-types";

interface QuizRushProps {
  documents: Array<{ id: string; filename: string }>;
  isConfigured: boolean;
  loadError: string | null;
}

interface GameReview {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  selectedIndex: number;
  explanation: string;
}

interface GameResults {
  score: number;
  correctCount: number;
  total: number;
  accuracy: number;
  bestStreak: number;
  xp: number;
  review: GameReview[];
  topicsToReview: string[];
}

interface AnswerFeedback {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  pointsEarned: number;
  streak: number;
  score: number;
  xp: number;
  isComplete: boolean;
  results?: GameResults;
}

const GAME_XP_PER_LEVEL = 100;

function isPublicQuestion(value: unknown): value is QuizQuestion {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const question = value as Record<string, unknown>;
  return (
    typeof question.question === "string" &&
    question.question.trim().length > 0 &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    question.options.every((option) => typeof option === "string" && option.length > 0)
  );
}

export default function QuizRush({ documents, isConfigured, loadError }: QuizRushProps) {
  const [documentId, setDocumentId] = useState(documents[0]?.id ?? "");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [gameScore, setGameScore] = useState(0);
  const [gameStreak, setGameStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [results, setResults] = useState<GameResults | null>(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);

  useEffect(() => setXpTotal(readArenaXp()), []);

  async function startGame() {
    if (!documentId || isStarting) return;
    setIsStarting(true);
    setError(null);
    setResults(null);
    setFeedback(null);
    setSelectedIndex(null);
    setQuestionIndex(0);
    setGameScore(0);
    setGameStreak(0);
    setBestStreak(0);
    setQuestions([]);
    setSessionId(null);

    try {
      const response = await fetch("/api/games/quiz-rush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const result = (await response.json()) as {
        sessionId?: string;
        questions?: QuizQuestion[];
        error?: string;
      };
      if (
        !response.ok ||
        typeof result.sessionId !== "string" ||
        !Array.isArray(result.questions) ||
        result.questions.length < 3 ||
        result.questions.length > 10 ||
        !result.questions.every(isPublicQuestion)
      ) {
        throw new Error(result.error ?? "Quiz Rush could not create a valid game.");
      }

      setSessionId(result.sessionId);
      setQuestions(result.questions);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Quiz Rush could not start.");
    } finally {
      setIsStarting(false);
    }
  }

  async function submitAnswer() {
    if (!sessionId || selectedIndex === null || isSubmitting || feedback) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/games/quiz-rush/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIndex, selectedIndex }),
      });
      const result = (await response.json()) as AnswerFeedback & { error?: string };
      if (
        !response.ok ||
        typeof result.isCorrect !== "boolean" ||
        typeof result.correctAnswer !== "string" ||
        typeof result.explanation !== "string" ||
        !Number.isInteger(result.pointsEarned) ||
        !Number.isInteger(result.streak) ||
        !Number.isInteger(result.score) ||
        !Number.isInteger(result.xp) ||
        typeof result.isComplete !== "boolean" ||
        (result.isComplete && (!result.results || !Array.isArray(result.results.review)))
      ) {
        throw new Error(result.error ?? "Your answer could not be checked.");
      }
      setFeedback(result);
      setGameScore(result.score);
      setGameStreak(result.streak);
      setBestStreak(Math.max(bestStreak, result.streak));

      if (result.isComplete && result.results) {
        setResults(result.results);
        try {
          setXpTotal(awardArenaXp(sessionId, result.results.xp));
          setProgressWarning(null);
        } catch (saveError) {
          console.error("Unable to save Arena XP on this device:", saveError);
          setProgressWarning("Your results are secure for this game, but this device couldn't save your XP total.");
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your answer could not be checked.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function continueGame() {
    if (!feedback || feedback.isComplete) return;
    setQuestionIndex((current) => current + 1);
    setSelectedIndex(null);
    setFeedback(null);
  }

  const level = Math.floor(xpTotal / GAME_XP_PER_LEVEL) + 1;
  const levelProgress = xpTotal % GAME_XP_PER_LEVEL;
  const currentQuestion = questions[questionIndex];

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#10182f] via-indigo-950 to-violet-900 px-5 py-8 text-white shadow-xl shadow-indigo-200/50 sm:px-9 sm:py-10">
        <div className="absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-200/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-200">
              <span aria-hidden="true">⚡</span> StudyBud Arena
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Quiz Rush</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
              A rapid-fire challenge built from your notes. Get answers right, build a streak, and earn XP.
            </p>
          </div>
          <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur sm:w-56">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Your level</p>
                <p className="mt-1 text-2xl font-black">Level {level}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300 text-xl text-amber-950" aria-hidden="true">✦</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/25">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-300 transition-all" style={{ width: `${levelProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-indigo-100">{xpTotal} total XP · {levelProgress}/{GAME_XP_PER_LEVEL} to next level</p>
          </div>
        </div>
      </section>

      {loadError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</p>}
      {!isConfigured && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Connect Supabase to choose lecture notes and start a game.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

      {results ? (
        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="text-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl text-amber-700" aria-hidden="true">🏆</span>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Run complete</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">Arena results</h2>
              <p className="mt-2 text-sm text-slate-500">Great work showing up for your learning.</p>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultStat label="Score" value={results.score.toLocaleString()} detail="points" />
              <ResultStat label="Accuracy" value={`${results.accuracy}%`} detail={`${results.correctCount}/${results.total} correct`} />
              <ResultStat label="Best streak" value={`${results.bestStreak}`} detail="in a row" />
              <ResultStat label="XP earned" value={`+${results.xp}`} detail={`Level ${level}`} />
            </div>
            {results.topicsToReview.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-bold text-amber-950">Worth another look</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900">
                  {results.topicsToReview.map((topic, index) => <li key={`${index}-${topic}`}>{topic}</li>)}
                </ul>
              </div>
            ) : (
              <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                Perfect run! You answered every question correctly.
              </p>
            )}
            {progressWarning && <p role="status" className="mt-4 text-sm text-amber-800">{progressWarning}</p>}
            <button type="button" onClick={() => { setResults(null); setFeedback(null); setSessionId(null); setQuestions([]); setQuestionIndex(0); setSelectedIndex(null); setGameScore(0); setGameStreak(0); setBestStreak(0); }} className="mt-6 min-h-12 w-full rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 sm:w-auto">
              Play Again
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h3 className="text-lg font-bold text-slate-950">Answer review</h3>
            <ol className="mt-4 space-y-3">
              {results.review.map((item, index) => {
                const wasCorrect = item.correctIndex === item.selectedIndex;
                return (
                  <li key={`${index}-${item.question}`} className={`rounded-2xl border p-4 ${wasCorrect ? "border-emerald-100 bg-emerald-50/50" : "border-rose-100 bg-rose-50/50"}`}>
                    <p className="text-sm font-bold text-slate-900">{index + 1}. {item.question}</p>
                    <p className="mt-2 text-xs text-slate-600">Your answer: {item.options[item.selectedIndex]}</p>
                    {!wasCorrect && <p className="mt-1 text-xs font-semibold text-emerald-800">Correct answer: {item.options[item.correctIndex]}</p>}
                    <p className="mt-2 text-xs leading-5 text-slate-600">{item.explanation}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      ) : currentQuestion ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">QUESTION {questionIndex + 1} / {questions.length}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">⚡ {gameStreak} streak</span>
            </div>
            <p className="text-sm font-bold text-slate-600">
              Score <span className="text-indigo-700">{gameScore}</span>
              <span className="ml-3 text-xs font-medium text-slate-500">Best streak {bestStreak}</span>
            </p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-500" style={{ width: `${((questionIndex + (feedback ? 1 : 0)) / questions.length) * 100}%` }} />
          </div>
          <h2 className="mt-7 text-xl font-bold leading-8 text-slate-950 sm:text-2xl">{currentQuestion.question}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedIndex === index;
              const correctOption = feedback?.correctAnswer === option;
              const optionStyle = feedback
                ? correctOption
                  ? "border-emerald-400 bg-emerald-50 text-emerald-950"
                  : isSelected
                    ? "border-rose-300 bg-rose-50 text-rose-950"
                    : "border-slate-200 bg-white text-slate-500"
                : isSelected
                  ? "border-indigo-500 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-100"
                  : "border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/50";
              return (
                <button key={`${index}-${option}`} type="button" disabled={Boolean(feedback) || isSubmitting} onClick={() => setSelectedIndex(index)} className={`flex min-h-16 items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold transition ${optionStyle}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${isSelected || correctOption ? "bg-white/80" : "bg-slate-100 text-slate-600"}`}>{String.fromCharCode(65 + index)}</span>
                  <span>{option}</span>
                  {feedback && correctOption && <span className="ml-auto text-lg text-emerald-600" aria-label="Correct answer">✓</span>}
                </button>
              );
            })}
          </div>
          {feedback && (
            <div role="status" className={`mt-5 rounded-2xl border p-4 ${feedback.isCorrect ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <p className={`text-sm font-bold ${feedback.isCorrect ? "text-emerald-900" : "text-amber-950"}`}>
                {feedback.isCorrect ? `Correct! +${feedback.pointsEarned} points` : "Not quite — keep learning!"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{feedback.explanation}</p>
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {!feedback ? (
              <button type="button" disabled={selectedIndex === null || isSubmitting} onClick={submitAnswer} className="min-h-12 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {isSubmitting ? "Checking answer..." : "Lock in answer"}
              </button>
            ) : (
              <button type="button" onClick={continueGame} className="min-h-12 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white transition hover:bg-indigo-700">
                Next question <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Single-player challenge</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Ready for the rush?</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Pick a set of notes. StudyBud will build up to 10 questions grounded in that material—the round adapts to how much distinct content your notes contain. Correct answers earn 100 points, streaks add a bonus, and every right answer earns XP.
              </p>
              <ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Instant answer feedback</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Explanations from your notes</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Streak points and XP</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Review topics to revisit</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
              {documents.length > 0 ? (
                <>
                  <label htmlFor="arena-document" className="text-xs font-bold text-slate-700">Choose your lecture notes</label>
                  <select id="arena-document" value={documentId} onChange={(event) => setDocumentId(event.target.value)} disabled={!isConfigured || isStarting} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                    {documents.map((document) => <option key={document.id} value={document.id}>{document.filename}</option>)}
                  </select>
                  <button type="button" onClick={startGame} disabled={!isConfigured || !documentId || isStarting || Boolean(loadError)} className="mt-4 min-h-12 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400">
                    {isStarting ? "Building your challenge..." : "Play Quiz Rush"}
                  </button>
                </>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-900">{isConfigured ? "Upload notes to unlock the Arena" : "Connect your study library"}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Quiz Rush uses your uploaded lecture materials to create a grounded challenge.</p>
                  <a href="/documents#upload-documents" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700">Go to My Documents</a>
                </div>
              )}
              <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">Game sessions expire after one hour. XP is saved on this device and is not synced.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ResultStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}
