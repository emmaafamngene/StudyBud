"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/ui/AppHeader";
import AppSidebar from "@/components/ui/AppSidebar";
import DocumentList from "@/features/documents/components/DocumentList";
import UploadForm from "@/features/documents/components/UploadForm";
import {
  DOCUMENT_SUBJECTS,
  type DocumentSubject,
  type DocumentSummary,
} from "@/features/documents/types";

interface DocumentsHomeProps {
  isConfigured: boolean;
}

const RECENT_DOCUMENTS_KEY = "studybud.recent-documents";
const RECENT_WINDOW_DAYS = 14;

function readRecentDocumentIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_DOCUMENTS_KEY) ?? "[]");
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? value : [];
  } catch {
    return [];
  }
}

export default function DocumentsHome({ isConfigured }: DocumentsHomeProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [metadataAvailable, setMetadataAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    setRecentIds(readRecentDocumentIds());
  }, []);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const result = (await response.json()) as {
        documents?: DocumentSummary[];
        metadataAvailable?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load your documents.");
      }

      setDocuments(result.documents ?? []);
      setMetadataAvailable(result.metadataAvailable !== false);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load your documents.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConfigured) {
      void loadDocuments();
    } else {
      setIsLoading(false);
    }
  }, [isConfigured, loadDocuments]);

  const subjectOptions = useMemo(
    () => DOCUMENT_SUBJECTS.filter((subject) => documents.some((document) => document.subject === subject)),
    [documents],
  );

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return documents.filter((document) => {
      const matchesSearch =
        !query ||
        document.filename.toLocaleLowerCase().includes(query) ||
        document.subject?.toLocaleLowerCase().includes(query);
      const matchesFilter =
        filter === "all" ||
        (filter === "recent" &&
          Date.now() - new Date(document.created_at).getTime() <=
            RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000) ||
        (filter === "opened" && recentIds.includes(document.id)) ||
        filter === `subject:${document.subject}`;
      return matchesSearch && matchesFilter;
    }).sort((left, right) => {
      if (filter !== "opened") return 0;
      return recentIds.indexOf(left.id) - recentIds.indexOf(right.id);
    });
  }, [documents, filter, recentIds, search]);

  function markRecentlyOpened(documentId: string) {
    try {
      const next = [documentId, ...readRecentDocumentIds().filter((id) => id !== documentId)].slice(0, 30);
      localStorage.setItem(RECENT_DOCUMENTS_KEY, JSON.stringify(next));
      setRecentIds(next);
    } catch (error) {
      console.error("Unable to save recent document history:", error);
    }
  }

  async function updateDocument(
    documentId: string,
    filename: string,
    subject: DocumentSubject | null,
  ) {
    setActionError(null);
    setNotice(null);
    setBusyDocumentId(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, subject }),
      });
      const result = (await response.json()) as {
        document?: DocumentSummary;
        error?: string;
      };
      if (!response.ok || !result.document) {
        throw new Error(result.error ?? "Unable to update this document.");
      }
      setDocuments((current) =>
        current.map((document) => (document.id === documentId ? result.document! : document)),
      );
      setNotice("Document details updated.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update this document.");
    } finally {
      setBusyDocumentId(null);
    }
  }

  async function deleteDocument(document: DocumentSummary) {
    setActionError(null);
    setNotice(null);
    setBusyDocumentId(document.id);
    try {
      const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      const result = (await response.json()) as { deleted?: boolean; warning?: string; error?: string };
      if (!response.ok || !result.deleted) {
        throw new Error(result.error ?? "Unable to delete this document.");
      }
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setRecentIds((current) => current.filter((id) => id !== document.id));
      try {
        localStorage.setItem(
          RECENT_DOCUMENTS_KEY,
          JSON.stringify(readRecentDocumentIds().filter((id) => id !== document.id)),
        );
      } catch (error) {
        console.error("Unable to update recent document history after deletion:", error);
      }
      if (result.warning) setActionError(result.warning);
      else setNotice("Document deleted.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete this document.");
    } finally {
      setBusyDocumentId(null);
    }
  }

  const filters = [
    { id: "all", label: "All documents" },
    { id: "recent", label: "Recently added" },
    { id: "opened", label: "Recently opened" },
    ...subjectOptions.map((subject) => ({ id: `subject:${subject}`, label: subject })),
  ];

  return (
    <div className="min-h-screen bg-[#f4f6fc]">
      <AppSidebar active="documents" />
      <div className="min-h-screen lg:pl-[220px]">
        <AppHeader active="library" />
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-600">
              Your personal library
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">My Documents</h1>
            <p className="mt-2 text-sm text-slate-500">
              Keep your lecture materials organized and ready for your next study session.
            </p>
          </div>
          <a
            href="#upload-documents"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <span aria-hidden="true">+</span> Upload notes
          </a>
        </header>

        {!isConfigured ? (
          <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Supabase is not configured yet. Add the server credentials from{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">.env.example</code> to{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code>, then apply the Supabase migrations.
          </div>
        ) : (
          <section id="upload-documents" className="mb-7 scroll-mt-20">
            <UploadForm onUploaded={loadDocuments} />
          </section>
        )}

        <section aria-labelledby="documents-heading" className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_3px_18px_-12px_rgba(15,23,42,0.24)] sm:p-5">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
                {documents.length} {documents.length === 1 ? "document" : "documents"}
              </p>
              <h2 id="documents-heading" className="mt-1 text-xl font-bold text-slate-950">
                Your study materials
              </h2>
            </div>
            <label className="relative w-full sm:max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">⌕</span>
              <span className="sr-only">Search your documents</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your documents..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>

          <nav aria-label="Filter documents" className="flex gap-2 overflow-x-auto py-4">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={`min-h-8 shrink-0 rounded-full px-3 text-[10px] font-semibold transition ${
                  filter === item.id
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {actionError && (
            <p role="alert" className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">
              {actionError}
            </p>
          )}
          {!metadataAvailable && (
            <p role="status" className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
              Your existing library is available. Apply{" "}
              <code>supabase/migrations/20261009065000_add_document_library_metadata.sql</code>{" "}
              to enable subject assignment and file sizes.
            </p>
          )}
          {notice && (
            <p role="status" className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
              {notice}
            </p>
          )}
          <DocumentList
            documents={filteredDocuments}
            isLoading={isLoading}
            error={loadError}
            onRetry={loadDocuments}
            onOpen={markRecentlyOpened}
            onRename={(id, filename) => {
              const document = documents.find((item) => item.id === id);
              if (!document) return Promise.reject(new Error("This document could not be found."));
              return updateDocument(id, filename, document.subject);
            }}
            onSetSubject={(id, subject) => {
              const document = documents.find((item) => item.id === id);
              if (!document) return Promise.reject(new Error("This document could not be found."));
              return updateDocument(id, document.filename, subject);
            }}
            onDelete={deleteDocument}
            busyDocumentId={busyDocumentId}
          />
        </section>
        </main>
      </div>
    </div>
  );
}
