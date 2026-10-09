import "server-only";
import type { DocumentSubject } from "@/features/documents/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface DocumentRecord {
  id: string;
  filename: string;
  storage_path: string;
  extracted_text: string;
  created_at: string;
  subject: DocumentSubject | null;
  file_size_bytes: number | null;
}

export type DocumentSummary = Pick<
  DocumentRecord,
  "id" | "filename" | "storage_path" | "created_at" | "subject" | "file_size_bytes"
>;

interface LibraryColumnsError {
  code?: string;
  message?: string;
}

function isMissingLibraryColumn(error: LibraryColumnsError): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find .* in the schema cache/i.test(error.message ?? "")
  );
}

export async function listDocuments(): Promise<{
  documents: DocumentSummary[];
  metadataAvailable: boolean;
}> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, storage_path, created_at, subject, file_size_bytes")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingLibraryColumn(error)) {
      console.warn("Document library metadata is unavailable; apply the document metadata migration.");
      const legacyResult = await supabase
        .from("documents")
        .select("id, filename, storage_path, created_at")
        .order("created_at", { ascending: false });
      if (legacyResult.error) {
        throw new Error(`Failed to list documents: ${legacyResult.error.message}`);
      }
      return {
        documents: legacyResult.data.map((document) => ({
          ...document,
          subject: null,
          file_size_bytes: null,
        })),
        metadataAvailable: false,
      };
    }
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  return { documents: data, metadataAvailable: true };
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, storage_path, extracted_text, created_at, subject, file_size_bytes")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingLibraryColumn(error)) {
      const legacyResult = await supabase
        .from("documents")
        .select("id, filename, storage_path, extracted_text, created_at")
        .eq("id", id)
        .maybeSingle();
      if (legacyResult.error) {
        throw new Error(`Failed to load document: ${legacyResult.error.message}`);
      }
      return legacyResult.data
        ? { ...legacyResult.data, subject: null, file_size_bytes: null }
        : null;
    }
    throw new Error(`Failed to load document: ${error.message}`);
  }

  return data;
}

export async function createDocument(
  document: Pick<
    DocumentRecord,
    "filename" | "storage_path" | "extracted_text" | "file_size_bytes"
  >,
): Promise<DocumentSummary> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("documents")
    .insert(document)
    .select("id, filename, storage_path, created_at, subject, file_size_bytes")
    .single();

  if (error) {
    if (isMissingLibraryColumn(error)) {
      console.warn("Saving document without file size; apply the document metadata migration.");
      const legacyResult = await supabase
        .from("documents")
        .insert({
          filename: document.filename,
          storage_path: document.storage_path,
          extracted_text: document.extracted_text,
        })
        .select("id, filename, storage_path, created_at")
        .single();
      if (legacyResult.error) {
        throw new Error(`Failed to save document: ${legacyResult.error.message}`);
      }
      return { ...legacyResult.data, subject: null, file_size_bytes: null };
    }
    throw new Error(`Failed to save document: ${error.message}`);
  }

  return data;
}

export async function updateDocument(
  id: string,
  changes: Pick<DocumentRecord, "filename" | "subject">,
): Promise<DocumentSummary> {
  const { data, error } = await getSupabaseAdmin()
    .from("documents")
    .update(changes)
    .eq("id", id)
    .select("id, filename, storage_path, created_at, subject, file_size_bytes")
    .maybeSingle();

  if (error) {
    if (isMissingLibraryColumn(error) && changes.subject === null) {
      const legacyResult = await getSupabaseAdmin()
        .from("documents")
        .update({ filename: changes.filename })
        .eq("id", id)
        .select("id, filename, storage_path, created_at")
        .maybeSingle();
      if (legacyResult.error) {
        throw new Error(`Failed to update document: ${legacyResult.error.message}`);
      }
      if (!legacyResult.data) throw new Error("Document was not found.");
      return { ...legacyResult.data, subject: null, file_size_bytes: null };
    }
    if (isMissingLibraryColumn(error)) {
      throw new Error("Apply the document metadata migration before assigning subjects.");
    }
    throw new Error(`Failed to update document: ${error.message}`);
  }
  if (!data) {
    throw new Error("Document was not found.");
  }
  return data;
}

export async function deleteDocumentRecord(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("documents").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}
