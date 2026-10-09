"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/ui/AppHeader";
import AppSidebar from "@/components/ui/AppSidebar";
import type { DocumentSummary } from "@/features/documents/types";
import { readQuizAttempts, type QuizAttempt } from "@/features/study/quiz-progress";

const RECENT_DOCUMENTS_KEY = "studybud.recent-documents";

function readRecentIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_DOCUMENTS_KEY) ?? "[]");
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? value : [];
  } catch {
    return [];
  }
}

export default function HomeDashboard({ isConfigured }: { isConfigured: boolean }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(isConfigured);
  const [error, setError] = useState<string | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    setRecentIds(readRecentIds());
    const refreshQuizProgress = () => setQuizAttempts(readQuizAttempts());
    refreshQuizProgress();
    window.addEventListener("pageshow", refreshQuizProgress);
    window.addEventListener("focus", refreshQuizProgress);
    return () => {
      window.removeEventListener("pageshow", refreshQuizProgress);
      window.removeEventListener("focus", refreshQuizProgress);
    };
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    let isCurrent = true;
    fetch("/api/documents", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { documents?: DocumentSummary[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load your study materials.");
        if (isCurrent) setDocuments(result.documents ?? []);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load your study materials.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isConfigured]);

  const nextDocument = useMemo(
    () =>
      documents.find((document) => recentIds.includes(document.id)) ??
      documents[0] ??
      null,
    [documents, recentIds],
  );

  const quizProgress = useMemo(() => {
    const totalPoints = quizAttempts.reduce((sum, attempt) => sum + attempt.score, 0);
    const totalPossible = quizAttempts.reduce((sum, attempt) => sum + attempt.total, 0);
    const averageScore = totalPossible
      ? Math.round((totalPoints / totalPossible) * 100)
      : null;

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfToday);
      date.setDate(startOfToday.getDate() - (6 - index));
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const count = quizAttempts.filter((attempt) => {
        const completed = new Date(attempt.completedAt);
        const completedKey = `${completed.getFullYear()}-${completed.getMonth()}-${completed.getDate()}`;
        return completedKey === dayKey;
      }).length;
      return {
        label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
        count,
      };
    });

    return { averageScore, days };
  }, [quizAttempts]);

  function markOpened(documentId: string) {
    try {
      const next = [documentId, ...recentIds.filter((id) => id !== documentId)].slice(0, 30);
      localStorage.setItem(RECENT_DOCUMENTS_KEY, JSON.stringify(next));
      setRecentIds(next);
    } catch (storageError) {
      console.error("Unable to save recent document history:", storageError);
    }
  }

  const quickActions = [
    { label: "Ask the AI tutor", description: "Get help from your notes", tool: "study", color: "indigo", icon: "✦" },
    { label: "Generate a quiz", description: "Check what you remember", tool: "quiz", color: "emerald", icon: "✓" },
    { label: "Summarize notes", description: "Review the key takeaways", tool: "summary", color: "violet", icon: "≡" },
    { label: "Create a mind map", description: "See how ideas connect", tool: "map", color: "amber", icon: "⌘" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f4f6fc]">
      <AppSidebar active="home" />
      <div className="min-h-screen lg:pl-[220px]">
        <AppHeader active="home" />
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#17224a] via-indigo-800 to-indigo-600 p-6 text-white shadow-lg shadow-indigo-200/60 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200">Your learning dashboard</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Welcome back! Ready to learn something new?</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
                Pick up where you left off or bring in new notes for your next study session.
              </p>
            </div>
            <Link
              href="/documents#upload-documents"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-white px-4 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 sm:self-center"
            >
              <span aria-hidden="true">↑</span> Upload notes
            </Link>
          </div>
        </section>

        {!isConfigured && (
          <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Connect Supabase to load your personal study materials.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-red-100 bg-white p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <section aria-labelledby="continue-heading" className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Pick up where you left off</p>
              <h2 id="continue-heading" className="mt-1 text-xl font-bold text-slate-950">Continue learning</h2>
            </div>
            <Link href="/documents" className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">
              All documents <span aria-hidden="true">→</span>
            </Link>
          </div>

          {isLoading ? (
            <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading your documents...</p>
          ) : nextDocument ? (
            <Link
              href={`/materials/${nextDocument.id}`}
              onClick={() => markOpened(nextDocument.id)}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <span className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-xs font-extrabold text-rose-600 ring-1 ring-rose-100">PDF</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-indigo-700">{nextDocument.filename}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {nextDocument.subject ?? "Unassigned subject"} · Added {new Date(nextDocument.created_at).toLocaleDateString()}
                </span>
              </span>
              <span className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white group-hover:bg-indigo-700">
                Continue studying
              </span>
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
              <p className="text-sm font-semibold text-slate-800">Your next study session starts with a document.</p>
              <p className="mt-1 text-xs text-slate-500">Upload lecture notes to ask questions, summarize, and practice.</p>
              <Link href="/documents#upload-documents" className="mt-3 inline-flex text-xs font-semibold text-indigo-700 hover:text-indigo-900">
                Upload your first PDF <span aria-hidden="true" className="ml-1">→</span>
              </Link>
            </div>
          )}
        </section>

        <section aria-labelledby="progress-heading" className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
                Activity on this device
              </p>
              <h2 id="progress-heading" className="mt-1 text-xl font-bold text-slate-950">
                Your learning progress
              </h2>
            </div>
            <Link href="/documents" className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">
              Manage materials <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <article className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Documents</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{documents.length}</p>
              <p className="mt-1 text-[10px] text-slate-500">In your Supabase library</p>
            </article>
            <article className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Quizzes completed</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{quizAttempts.length}</p>
              <p className="mt-1 text-[10px] text-slate-500">Saved on this device</p>
            </article>
            <article className="rounded-lg border border-violet-100 bg-violet-50/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">Average quiz score</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {quizProgress.averageScore === null ? "—" : `${quizProgress.averageScore}%`}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {quizAttempts.length ? `Across ${quizAttempts.length} completed ${quizAttempts.length === 1 ? "quiz" : "quizzes"}` : "Complete a quiz to start tracking"}
              </p>
            </article>
          </div>

          <div className="mt-5 rounded-lg border border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900">Weekly quiz activity</h3>
                <p className="mt-1 text-[10px] text-slate-500">Completed quizzes per day · last 7 days</p>
              </div>
              <span className="text-[10px] text-slate-500">
                {quizProgress.days.reduce((sum, day) => sum + day.count, 0)} this week
              </span>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {quizProgress.days.map((day) => (
                <div key={day.label} className="flex min-w-0 flex-col items-center gap-1.5">
                  <span className="text-[9px] font-medium text-slate-500">{day.count}</span>
                  <div
                    role="img"
                    aria-label={`${day.label}: ${day.count} ${day.count === 1 ? "quiz" : "quizzes"}`}
                    className={`flex h-12 w-full max-w-10 items-end overflow-hidden rounded-md bg-indigo-50 ${
                      day.count ? "justify-center" : ""
                    }`}
                  >
                    {day.count > 0 && (
                      <span
                        className="w-full rounded-md bg-indigo-500"
                        style={{ height: `${Math.min(100, Math.max(25, day.count * 25))}%` }}
                      />
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500">{day.label}</span>
                </div>
              ))}
            </div>
            {quizAttempts.length === 0 && (
              <p className="mt-3 text-center text-[10px] text-slate-500">
                Your completed quizzes will appear here.
              </p>
            )}
          </div>
          <p className="mt-4 text-[10px] leading-4 text-slate-500">
            Quiz history is stored only in this browser and is not synced between devices. Study time and streaks are not tracked.
          </p>
        </section>

        <section aria-labelledby="actions-heading" className="mt-8">
          <div className="mb-4">
            <h2 id="actions-heading" className="text-xl font-bold text-slate-950">Quick actions</h2>
            <p className="mt-1 text-xs text-slate-500">Choose a tool and keep your study momentum going.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <Link
                key={action.tool}
                href={nextDocument ? `/materials/${nextDocument.id}?tool=${action.tool}` : "/documents#upload-documents"}
                onClick={() => {
                  if (nextDocument) markOpened(nextDocument.id);
                }}
                className={`rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  action.color === "indigo" ? "border-indigo-100 hover:border-indigo-200" :
                  action.color === "emerald" ? "border-emerald-100 hover:border-emerald-200" :
                  action.color === "violet" ? "border-violet-100 hover:border-violet-200" :
                  "border-amber-100 hover:border-amber-200"
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm text-white ${
                  action.color === "indigo" ? "bg-indigo-500" :
                  action.color === "emerald" ? "bg-emerald-500" :
                  action.color === "violet" ? "bg-violet-500" :
                  "bg-amber-500"
                }`}>{action.icon}</span>
                <span className="mt-3 block text-xs font-bold text-slate-900">{action.label}</span>
                <span className="mt-1 block text-[10px] text-slate-500">{action.description}</span>
              </Link>
            ))}
          </div>
        </section>
        </main>
      </div>
    </div>
  );
}
