"use client";

import { useRef, useState, type FormEvent } from "react";

interface UploadFormProps {
  onUploaded: () => Promise<void>;
}

export default function UploadForm({ onUploaded }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const prepareResponse = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selectedFile.name,
          size: selectedFile.size,
        }),
      });
      const upload = (await prepareResponse.json()) as {
        storagePath?: string;
        signedUrl?: string;
        error?: string;
      };

      if (!prepareResponse.ok || !upload.storagePath || !upload.signedUrl) {
        throw new Error(upload.error ?? "Unable to prepare the PDF upload.");
      }

      const storageResponse = await fetch(upload.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/pdf",
          "x-upsert": "false",
        },
        body: selectedFile,
      });

      if (!storageResponse.ok) {
        throw new Error("The PDF could not be uploaded to Supabase Storage. Please try again.");
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selectedFile.name,
          storagePath: upload.storagePath,
          fileSizeBytes: selectedFile.size,
        }),
      });
      const result = (await response.json()) as {
        document?: { filename: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "The PDF could not be uploaded.");
      }

      setSuccess(`${result.document?.filename ?? selectedFile.name} was uploaded successfully.`);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await onUploaded();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The PDF could not be uploaded. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_55px_-38px_rgba(49,46,129,0.42)] sm:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-950 sm:text-lg">Bring your notes in</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Add a text-based PDF to start a new study session.
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={!selectedFile || isUploading}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:shadow-none"
        >
          {isUploading ? "Uploading and reading..." : "Upload PDF"}
        </button>
      </div>

      <label
        htmlFor="pdf-upload"
        className="group mt-6 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105 group-hover:ring-indigo-200">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path d="M7 3.75h6l5 5v10.5A1.75 1.75 0 0 1 16.25 21h-9.5A1.75 1.75 0 0 1 5 19.25v-13.5A2 2 0 0 1 7 3.75Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M13 4v5h5M8.5 14h7m-7 3h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <span className="mt-3 text-sm font-semibold text-slate-800">
          {selectedFile ? selectedFile.name : "Choose a PDF to get started"}
        </span>
        <span className="mt-1 text-xs text-slate-500">
          Select a file from your device <span aria-hidden="true">·</span> PDF up to 20 MB
        </span>
        <input
          ref={inputRef}
          id="pdf-upload"
          name="file"
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          disabled={isUploading}
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
            setError(null);
            setSuccess(null);
          }}
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          {success}
        </p>
      )}
    </form>
  );
}
