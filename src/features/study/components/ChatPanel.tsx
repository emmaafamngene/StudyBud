"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { ChatMessage, ChatTurn } from "@/features/study/types";
import {
  DEFAULT_PREFERENCES,
  readStudyPreferences,
  type StudyPreferences,
} from "@/features/settings/preferences";

interface ChatPanelProps {
  documentId: string;
  workspace?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "Give me a simple explanation of the main idea",
  "What should I remember from these notes?",
  "Explain a tricky concept with an example",
];

function renderInlineMarkdown(text: string, lineIndex: number) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, partIndex) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${lineIndex}-${partIndex}`} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${lineIndex}-${partIndex}`} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-indigo-800">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`${lineIndex}-${partIndex}`}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderAnswerLine(line: string, lineIndex: number) {
  const heading = /^(#{1,6})\s+(.+)$/.exec(line);
  if (heading) {
    return (
      <h3 key={lineIndex} className="mb-1 mt-4 text-sm font-bold text-slate-900 first:mt-0">
        {renderInlineMarkdown(heading[2], lineIndex)}
      </h3>
    );
  }
  if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
    return <hr key={lineIndex} className="my-3 border-slate-200" />;
  }
  if (/^\s*[-*]\s+/.test(line)) {
    const content = renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ""), lineIndex);
    return <p key={lineIndex} className="my-1 flex gap-2 pl-1">
      <span className="shrink-0 text-indigo-500">•</span>
      <span>{content}</span>
    </p>;
  }
  const orderedList = /^\s*(\d+\.)\s+/.exec(line);
  if (orderedList) {
    const content = renderInlineMarkdown(line.replace(/^\s*\d+\.\s+/, ""), lineIndex);
    return <p key={lineIndex} className="my-1 flex gap-2 pl-1">
      <span className="shrink-0 font-semibold text-indigo-600">{orderedList[1]}</span>
      <span>{content}</span>
    </p>;
  }
  return line.trim()
    ? <p key={lineIndex} className="my-2 first:mt-0 last:mb-0">{renderInlineMarkdown(line, lineIndex)}</p>
    : <div key={lineIndex} className="h-1" />;
}

function renderAnswer(answer: string): ReactNode[] {
  const lines = answer.split(/\r?\n/);
  const rendered: ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const codeFence = /^\s*```(\w*)\s*$/.exec(lines[index]);
    if (!codeFence) {
      rendered.push(renderAnswerLine(lines[index], index));
      continue;
    }

    const codeLines: string[] = [];
    index += 1;
    while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
      codeLines.push(lines[index]);
      index += 1;
    }
    rendered.push(
      <pre
        key={`code-${index}`}
        className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100"
      >
        <code>{codeLines.join("\n")}</code>
      </pre>,
    );
  }

  return rendered;
}

function AssistantAnswer({ answer }: { answer: string }) {
  return (
    <div className="text-[13px] leading-6 text-slate-700">
      {renderAnswer(answer)}
    </div>
  );
}

export default function ChatPanel({ documentId, workspace = false }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [preferences, setPreferences] = useState<StudyPreferences>(DEFAULT_PREFERENCES);
  const conversationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPreferences(readStudyPreferences());
  }, []);

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  async function sendQuestion(submittedQuestion: string) {
    const trimmedQuestion = submittedQuestion.trim();
    if (!trimmedQuestion || isSending) return;

    const history: ChatMessage[] = turns
      .filter((turn): turn is ChatTurn & { answer: string } => Boolean(turn.answer))
      .slice(-5)
      .flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.answer },
      ]);
    const turnIndex = turns.length;
    setTurns((current) => [...current, { question: trimmedQuestion, pending: true }]);
    setQuestion("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, history, preferences }),
      });
      const result = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !result.answer) {
        throw new Error(result.error ?? "StudyBud could not answer just now.");
      }

      setTurns((current) =>
        current.map((turn, index) =>
          index === turnIndex ? { question: trimmedQuestion, answer: result.answer } : turn,
        ),
      );
    } catch (error) {
      setTurns((current) =>
        current.map((turn, index) =>
          index === turnIndex
            ? {
                question: trimmedQuestion,
                error:
                  error instanceof Error
                    ? error.message
                    : "StudyBud could not answer just now. Please try again.",
              }
            : turn,
        ),
      );
      setQuestion(trimmedQuestion);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(question);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(question);
    }
  }

  return (
    <section
      aria-label="Chat with StudyBud"
      className={`flex min-h-0 flex-col overflow-hidden border border-slate-200/80 bg-white shadow-[0_8px_32px_-20px_rgba(15,23,42,0.3)] ${
        workspace
          ? "h-[calc(100vh-84px)] min-h-[520px] rounded-2xl"
          : "h-[min(76vh,760px)] min-h-[540px] rounded-3xl"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200/60">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13l-5.6-2 5.6-2L12 3.5Z" fill="currentColor" />
              <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" fill="currentColor" opacity=".75" />
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-950">StudyBud</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Your AI study companion
            </p>
          </div>
        </div>
        <span className="hidden rounded-full border border-indigo-100 bg-indigo-50/70 px-2.5 py-1 text-[10px] font-semibold text-indigo-700 sm:inline-flex">
          Grounded in your notes
        </span>
      </header>

      <div
        ref={conversationRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation"
        className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_rgba(238,242,255,0.46),_transparent_55%)] px-3 py-5 sm:px-5 sm:py-6"
      >
        {turns.length === 0 ? (
          <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-700 ring-1 ring-indigo-100">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                <path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13l-5.6-2 5.6-2L12 3.5Z" fill="currentColor" />
              </svg>
            </span>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900">What would you like to understand?</h3>
            <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
              Ask anything about this document. StudyBud will explain it clearly using your notes.
            </p>
            <div className="mt-5 grid w-full gap-2">
              {SUGGESTED_QUESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void sendQuestion(suggestion)}
                  disabled={isSending}
                  className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs leading-5 text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-800 disabled:opacity-50"
                >
                  {suggestion}
                  <span className="float-right pl-2 text-slate-400" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {turns.map((turn, index) => (
              <div key={`${index}-${turn.question}`} className="space-y-4">
                <div className="flex justify-end gap-2.5">
                  <div className="max-w-[88%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-indigo-700 px-4 py-3 text-[13px] leading-6 text-white shadow-sm shadow-indigo-100 sm:max-w-[82%]">
                    <p className="whitespace-pre-wrap">{turn.question}</p>
                  </div>
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600" aria-label="You">
                    Y
                  </span>
                </div>

                {(turn.pending || turn.answer || turn.error) && (
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm" aria-label="StudyBud">
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                        <path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13l-5.6-2 5.6-2L12 3.5Z" fill="currentColor" />
                      </svg>
                    </span>
                    <div className="min-w-0 max-w-[92%] pt-0.5">
                      {turn.pending && (
                        <div role="status" className="flex items-center gap-2 py-1 text-xs text-slate-500">
                          <span className="flex gap-1" aria-hidden="true">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:300ms]" />
                          </span>
                          Thinking through your notes
                        </div>
                      )}
                      {turn.answer && (
                        <AssistantAnswer answer={turn.answer} />
                      )}
                      {turn.error && (
                        <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">
                          {turn.error}
                          <p className="mt-1 text-rose-700">Your question is back in the box so you can retry.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-100 bg-white px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2 shadow-sm transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50">
          <label className="sr-only" htmlFor={`study-question-${documentId}`}>
            Ask a question about this document
          </label>
          <textarea
            ref={inputRef}
            id={`study-question-${documentId}`}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleInputKeyDown}
            maxLength={2000}
            rows={1}
            placeholder="Message StudyBud..."
            disabled={isSending}
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-[13px] leading-5 text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <button
            type="submit"
            aria-label={isSending ? "StudyBud is thinking" : "Send message"}
            disabled={!question.trim() || isSending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isSending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
                <path d="M12 19V5m0 0L6.5 10.5M12 5l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-slate-400">
          Answers are based on your uploaded material · Enter to send, Shift + Enter for a new line
        </p>
      </form>
    </section>
  );
}
