"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  DOCUMENT_SUBJECTS,
  isDocumentSubject,
  type DocumentSubject,
  type DocumentSummary,
} from "@/features/documents/types";

interface DocumentListProps {
  documents: DocumentSummary[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (documentId: string) => void;
  onRename: (documentId: string, filename: string) => Promise<void>;
  onSetSubject: (documentId: string, subject: DocumentSubject | null) => Promise<void>;
  onDelete: (document: DocumentSummary) => Promise<void>;
  busyDocumentId: string | null;
}

function formatFileSize(size: number | null): string | null {
  if (size === null) return null;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentList({
  documents,
  isLoading,
  error,
  onRetry,
  onOpen,
  onRename,
  onSetSubject,
  onDelete,
  busyDocumentId,
}: DocumentListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  async function submitRename(event: FormEvent<HTMLFormElement>, documentId: string) {
    event.preventDefault();
    await onRename(documentId, draftName);
    setEditingId(null);
  }

  if (isLoading) {
    return (
      <div role="status" className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-500">
        <span className="mx-auto mb-3 block h-6 w-6 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600" />
        Loading your documents...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-white px-6 py-10 text-center">
        <p role="alert" className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          Try again
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600" aria-hidden="true">▤</span>
        <p className="mt-4 font-semibold text-slate-900">No documents match this view.</p>
        <p className="mt-2 text-sm text-slate-500">Try another filter or upload a PDF to get started.</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {documents.map((document) => {
        const fileSize = formatFileSize(document.file_size_bytes);
        const isBusy = busyDocumentId === document.id;

        return (
          <li
            key={document.id}
            className="group min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_5px_20px_-16px_rgba(15,23,42,0.35)] transition hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-[10px] font-extrabold tracking-wide text-rose-600 ring-1 ring-rose-100">
                PDF
              </span>
              <div className="min-w-0 flex-1">
                {editingId === document.id ? (
                  <form onSubmit={(event) => void submitRename(event, document.id)} className="flex gap-1.5">
                    <label className="sr-only" htmlFor={`rename-${document.id}`}>New PDF filename</label>
                    <input
                      id={`rename-${document.id}`}
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      maxLength={255}
                      autoFocus
                      className="min-w-0 flex-1 rounded-md border border-indigo-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      type="submit"
                      disabled={isBusy || !draftName.trim()}
                      className="rounded-md bg-indigo-600 px-2 text-[10px] font-semibold text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-1.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <h3 className="break-words text-sm font-bold leading-5 text-slate-900">
                    {document.filename}
                  </h3>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-500">
                  <span>PDF</span><span aria-hidden="true">·</span>
                  <span>{document.subject ?? "Unassigned subject"}</span>
                  <span aria-hidden="true">·</span>
                  <span>Added {new Date(document.created_at).toLocaleDateString()}</span>
                  {fileSize && <><span aria-hidden="true">·</span><span>{fileSize}</span></>}
                </div>
              </div>
              <details className="relative shrink-0">
                <summary
                  aria-label={`Actions for ${document.filename}`}
                  className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
                >
                  <span aria-hidden="true">•••</span>
                </summary>
                <div className="absolute right-0 top-9 z-10 w-40 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftName(document.filename);
                      setEditingId(document.id);
                    }}
                    className="w-full rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Rename
                  </button>
                  <a
                    href={`/api/documents/${document.id}/download`}
                    className="block rounded-md px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Download PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete "${document.filename}" from your library?`)) {
                        void onDelete(document);
                      }
                    }}
                    disabled={isBusy}
                    className="w-full rounded-md px-2.5 py-2 text-left text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete document
                  </button>
                </div>
              </details>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <label className="min-w-0">
                <span className="sr-only">Subject for {document.filename}</span>
                <select
                  value={document.subject ?? ""}
                  disabled={isBusy}
                  onChange={(event) => {
                    const value = event.target.value;
                    void onSetSubject(
                      document.id,
                      value && isDocumentSubject(value) ? value : null,
                    );
                  }}
                  className="max-w-36 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-600 outline-none focus:border-indigo-300"
                >
                  <option value="">Assign subject</option>
                  {DOCUMENT_SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>
              <Link
                href={`/materials/${document.id}`}
                onClick={() => onOpen(document.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-indigo-700"
              >
                Open document <span aria-hidden="true">→</span>
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
