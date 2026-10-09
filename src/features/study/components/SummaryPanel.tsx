"use client";

import { useState } from "react";

interface SummaryPanelProps {
  documentId: string;
}

export default function SummaryPanel({ documentId }: SummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readableSummary = summary
    ?.replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*[*-]\s/gm, "• ");

  async function generateSummary() {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/summary`, { method: "POST" });
      const result = (await response.json()) as { summary?: string; error?: string };
      if (!response.ok || !result.summary) {
        throw new Error(result.error ?? "StudyBud couldn't create a summary. Please try again.");
      }
      setSummary(result.summary);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "StudyBud couldn't create a summary. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-violet-700">
            Review key points
          </p>
          <h2 className="mt-1 text-base font-bold text-slate-950">AI summary</h2>
        </div>
        <button
          type="button"
          onClick={generateSummary}
          disabled={isGenerating}
          className="min-h-10 shrink-0 rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"
        >
          {isGenerating ? "Summarizing..." : summary ? "Refresh summary" : "Summarize notes"}
        </button>
      </div>
      <div className="p-4 sm:p-5">
        {isGenerating && (
          <p role="status" className="rounded-xl bg-violet-50 p-4 text-sm text-violet-800">
            StudyBud is reviewing your notes...
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">
            {error}
          </p>
        )}
        {!summary && !isGenerating && !error && (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">
            Get a concise review of the key concepts, definitions, and important details.
          </p>
        )}
        {readableSummary && !isGenerating && (
          <div
            aria-live="polite"
            className="whitespace-pre-wrap rounded-2xl bg-violet-50/70 p-4 text-sm leading-7 text-slate-700"
          >
            {readableSummary}
          </div>
        )}
      </div>
    </section>
  );
}
