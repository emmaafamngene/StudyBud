"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type WorkspaceSection = "home" | "documents" | "study" | "games" | "settings";

const RECENT_DOCUMENTS_KEY = "studybud.recent-documents";

interface AppSidebarProps {
  active: WorkspaceSection;
  currentDocument?: {
    id: string;
    filename: string;
  };
}

const navigation: Array<{
  id: WorkspaceSection;
  label: string;
  href?: (currentDocument?: AppSidebarProps["currentDocument"]) => string;
  icon: string;
}> = [
  { id: "home", label: "Home", href: () => "/", icon: "⌂" },
  { id: "documents", label: "My Documents", href: () => "/documents", icon: "▤" },
  {
    id: "study",
    label: "Study Workspace",
    icon: "▣",
  },
  { id: "games", label: "Games", href: () => "/games", icon: "⚡" },
  { id: "settings", label: "Settings", href: () => "/settings", icon: "⚙" },
];

export default function AppSidebar({ active, currentDocument }: AppSidebarProps) {
  const [recentDocumentId, setRecentDocumentId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    try {
      const stored: unknown = JSON.parse(localStorage.getItem(RECENT_DOCUMENTS_KEY) ?? "[]");
      if (Array.isArray(stored) && typeof stored[0] === "string") {
        setRecentDocumentId(stored[0]);
      }
    } catch (error) {
      console.error("Unable to read the recently opened study document:", error);
    }

    fetch("/api/documents", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          documents?: Array<{ id: string }>;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error ?? "Unable to load study documents.");

        const documents = result.documents ?? [];
        const stored: unknown = JSON.parse(localStorage.getItem(RECENT_DOCUMENTS_KEY) ?? "[]");
        const recentIds = Array.isArray(stored)
          ? stored.filter((id): id is string => typeof id === "string")
          : [];
        const documentId =
          documents.find((document) => recentIds.includes(document.id))?.id ??
          documents[0]?.id ??
          null;
        if (isCurrent) setRecentDocumentId(documentId);
      })
      .catch((error: unknown) => {
        if (isCurrent) console.error("Unable to resolve the Study Workspace link:", error);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const workspaceHref = currentDocument
    ? `/materials/${currentDocument.id}`
    : recentDocumentId
      ? `/materials/${recentDocumentId}`
      : "/documents";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col bg-[#10182f] px-3.5 py-4 text-white lg:flex">
      <Link href="/" className="mb-7 flex items-center gap-3 px-1" aria-label="StudyBud home">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-300 to-indigo-600 text-lg font-black text-white ring-2 ring-indigo-300/30">
          ◉
        </span>
        <span>
          <span className="block text-xl font-extrabold tracking-tight">
            Study<span className="text-indigo-400">Bud</span>
          </span>
          <span className="block text-[10px] text-slate-400">Learn Smarter, Not Harder</span>
        </span>
      </Link>

      <nav aria-label="Workspace navigation" className="space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.id}
            href={
              item.id === "study"
                ? workspaceHref
                : item.href?.(currentDocument) ?? "/"
            }
            aria-current={active === item.id ? "page" : undefined}
            className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition ${
              active === item.id
                ? "bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-950/20"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
          </Link>
        ))}
      </nav>

      {currentDocument && (
        <div className="mt-7 min-w-0">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Current document
          </p>
          <Link
            href={`/materials/${currentDocument.id}`}
            aria-current="page"
            title={currentDocument.filename}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-indigo-400/20 bg-indigo-500/20 px-2.5 py-3 text-xs text-indigo-100"
          >
            <span className="flex h-8 w-7 shrink-0 items-center justify-center rounded bg-rose-500 text-[10px] font-bold text-white">
              PDF
            </span>
            <span className="min-w-0 truncate">{currentDocument.filename}</span>
          </Link>
        </div>
      )}

      <div className="mt-auto rounded-xl border border-indigo-300/15 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 p-3.5">
        <span className="text-lg" aria-hidden="true">🌱</span>
        <p className="mt-2 text-xs font-semibold text-slate-100">Small steps add up.</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-400">Keep going, one idea at a time.</p>
      </div>
    </aside>
  );
}
