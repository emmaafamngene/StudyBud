"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppSidebar from "@/components/ui/AppSidebar";
import ChatPanel from "@/features/study/components/ChatPanel";
import ConceptMapPanel from "@/features/study/components/ConceptMapPanel";
import QuizPanel from "@/features/study/components/QuizPanel";
import SummaryPanel from "@/features/study/components/SummaryPanel";

interface StudyWorkspaceProps {
  documentId: string;
  filename: string;
  createdAtLabel: string;
  previewUrl: string | null;
  previewError: string | null;
  extractedText: string;
  wordCount: number;
  initialTab: StudyTab;
}

type StudyTab = "study" | "summary" | "quiz" | "map";
const RECENT_DOCUMENTS_KEY = "studybud.recent-documents";

const tabs: Array<{ id: StudyTab; label: string; icon: string }> = [
  { id: "study", label: "Study", icon: "▤" },
  { id: "summary", label: "Summary", icon: "☷" },
  { id: "quiz", label: "Quiz", icon: "◎" },
  { id: "map", label: "Mind Map", icon: "⌘" },
];

export default function StudyWorkspace({
  documentId,
  filename,
  createdAtLabel,
  previewUrl,
  previewError,
  extractedText,
  wordCount,
  initialTab,
}: StudyWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<StudyTab>(initialTab);
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(RECENT_DOCUMENTS_KEY) ?? "[]");
      const recentIds = Array.isArray(value) && value.every((id) => typeof id === "string")
        ? value
        : [];
      localStorage.setItem(
        RECENT_DOCUMENTS_KEY,
        JSON.stringify([documentId, ...recentIds.filter((id) => id !== documentId)].slice(0, 30)),
      );
    } catch (error) {
      console.error("Unable to save recent document history:", error);
    }
  }, [documentId]);

  const visibleText = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return extractedText;
    return extractedText
      .split(/\n+/)
      .filter((line) => line.toLocaleLowerCase().includes(query))
      .join("\n\n");
  }, [extractedText, search]);

  return (
    <div className="min-h-screen bg-[#f4f6fc] text-slate-900">
      <AppSidebar
        active="study"
        currentDocument={{ id: documentId, filename }}
      />
      <div className="min-h-screen lg:pl-[220px]">
        <header className="sticky top-0 z-20 flex h-[54px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden" aria-label="StudyBud home">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-black text-white">S</span>
            <span className="font-bold">Study<span className="text-indigo-600">Bud</span></span>
          </Link>
          <label className="relative hidden max-w-xl flex-1 md:block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">⌕</span>
            <span className="sr-only">Search in your document</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search in your document..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <Link
            href="/documents"
            className="ml-auto inline-flex h-9 shrink-0 items-center rounded-lg border border-indigo-100 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            My Documents
          </Link>
          <Link
            href="/settings"
            className="inline-flex h-9 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Settings
          </Link>
        </header>

        <main className="mx-auto max-w-[1600px] px-3 pb-7 pt-4 sm:px-5 lg:px-4 xl:px-6">
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
            <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_3px_18px_-12px_rgba(15,23,42,0.24)]">
              <header className="flex min-h-[62px] items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-7 shrink-0 items-center justify-center rounded bg-rose-500 text-[9px] font-bold text-white">PDF</span>
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-bold text-slate-900">{filename}</h1>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Study material <span className="mx-1 text-slate-300">·</span>
                      {wordCount.toLocaleString()} words
                      <span className="mx-1 text-slate-300">·</span>
                      Added {createdAtLabel}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-indigo-100 px-2.5 py-2 text-[10px] font-semibold text-indigo-700 transition hover:bg-indigo-50 sm:px-3 sm:text-xs"
                    >
                      Open PDF
                    </a>
                  )}
                  <Link
                    href="/"
                    className="rounded-lg border border-indigo-100 px-2.5 py-2 text-[10px] font-semibold text-indigo-700 transition hover:bg-indigo-50 sm:px-3 sm:text-xs"
                  >
                    Change
                  </Link>
                </div>
              </header>

              <nav aria-label="Study tools" className="flex overflow-x-auto border-b border-slate-100 px-2 sm:px-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition sm:px-4 ${
                      activeTab === tab.id
                        ? "border-indigo-500 text-indigo-700"
                        : "border-transparent text-slate-500 hover:text-indigo-600"
                    }`}
                  >
                    <span aria-hidden="true" className="text-sm">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="h-[55vh] min-h-[320px] max-h-[520px] overflow-y-auto bg-[#f9faff] p-3 sm:p-4">
                {activeTab === "study" && (
                  previewUrl ? (
                    <iframe
                      title={`${filename} PDF preview`}
                      src={previewUrl}
                      className="h-full min-h-[300px] w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                    />
                  ) : (
                    <div className="mx-auto h-full max-w-3xl overflow-y-auto">
                    {previewError && (
                      <p role="status" className="mb-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                        {previewError}
                      </p>
                    )}
                    <article className="min-h-[300px] rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-9 sm:py-8">
                      {extractedText ? (
                        <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-slate-700 sm:text-sm sm:leading-7">
                          {visibleText || (search ? "No matching text in this document." : extractedText)}
                        </pre>
                      ) : (
                        <p className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                          No selectable text was extracted from this PDF. It may contain scanned or image-only pages; OCR is not supported yet.
                        </p>
                      )}
                    </article>
                    </div>
                  )
                )}
                {activeTab === "summary" && <SummaryPanel documentId={documentId} />}
                {activeTab === "quiz" && <QuizPanel documentId={documentId} />}
                {activeTab === "map" && <ConceptMapPanel documentId={documentId} />}
              </div>

              <section aria-labelledby="quick-actions-title" className="border-t border-slate-100 p-3 sm:p-4">
                <div className="mb-3">
                  <h2 id="quick-actions-title" className="text-xs font-bold text-slate-900">Quick Actions</h2>
                  <p className="mt-0.5 text-[10px] text-slate-500">Choose a tool to get more from your notes.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => document.getElementById("study-question")?.focus()}
                    className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-sm text-white">?</span>
                    <span className="mt-2 block text-[11px] font-bold text-slate-800">Ask a Question</span>
                    <span className="mt-1 block text-[10px] text-slate-500">Answers from your notes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("quiz")}
                    className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">✓</span>
                    <span className="mt-2 block text-[11px] font-bold text-slate-800">Generate Quiz</span>
                    <span className="mt-1 block text-[10px] text-slate-500">Test your understanding</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("summary")}
                    className="rounded-lg border border-violet-100 bg-violet-50/70 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-sm text-white">≡</span>
                    <span className="mt-2 block text-[11px] font-bold text-slate-800">Create Summary</span>
                    <span className="mt-1 block text-[10px] text-slate-500">Key points & takeaways</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("map")}
                    className="rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-sm text-white">⌘</span>
                    <span className="mt-2 block text-[11px] font-bold text-slate-800">Generate Mind Map</span>
                    <span className="mt-1 block text-[10px] text-slate-500">Visualize the concepts</span>
                  </button>
                </div>
              </section>
            </section>

            <div className="min-w-0 lg:sticky lg:top-[66px]">
              <ChatPanel documentId={documentId} workspace />
            </div>
          </div>
          <footer className="py-5 text-center text-[10px] text-slate-400">
            Answers are based on your uploaded document.
          </footer>
        </main>
      </div>
    </div>
  );
}
