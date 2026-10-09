import { NextResponse } from "next/server";
import { isDocumentSubject } from "@/features/documents/types";
import { deleteDocumentRecord, getDocument, updateDocument } from "@/lib/documents/repository";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { documentId } = await params;
  let body: { filename?: unknown; subject?: unknown };

  try {
    body = (await request.json()) as { filename?: unknown; subject?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid document update." }, { status: 400 });
  }

  if (
    typeof body.filename !== "string" ||
    !body.filename.trim() ||
    body.filename.trim().length > 255 ||
    !body.filename.toLowerCase().endsWith(".pdf") ||
    !(body.subject === null || isDocumentSubject(body.subject))
  ) {
    return NextResponse.json(
      { error: "Enter a PDF filename and choose a valid subject." },
      { status: 400 },
    );
  }

  try {
    const document = await updateDocument(documentId, {
      filename: body.filename.trim(),
      subject: body.subject,
    });
    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof Error && error.message === "Document was not found.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Unable to update document details:", error);
    return NextResponse.json(
      { error: "Unable to update this document. Please try again." },
      { status: 503 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { documentId } = await params;
  let document;
  try {
    document = await getDocument(documentId);
    if (!document) {
      return NextResponse.json({ error: "This document could not be found." }, { status: 404 });
    }
    await deleteDocumentRecord(documentId);
  } catch (error) {
    console.error("Unable to delete document record:", error);
    return NextResponse.json(
      { error: "Unable to delete this document. Please try again." },
      { status: 503 },
    );
  }

  let storageError: Error | null = null;
  try {
    const result = await getSupabaseAdmin()
      .storage.from("documents")
      .remove([document.storage_path]);
    storageError = result.error;
  } catch (error) {
    storageError = error instanceof Error ? error : new Error("Unknown storage deletion error.");
  }

  if (storageError) {
    console.error("Document was removed from the library but its stored PDF could not be deleted:", {
      documentId,
      storagePath: document.storage_path,
      error: storageError,
    });
    return NextResponse.json({
      deleted: true,
      warning: "The document left your library, but its stored PDF could not be removed.",
    });
  }

  return NextResponse.json({ deleted: true });
}
