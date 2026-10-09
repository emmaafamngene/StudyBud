import { NextResponse } from "next/server";
import { getDocument } from "@/lib/documents/repository";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;

  try {
    const document = await getDocument(documentId);
    if (!document) {
      return NextResponse.json({ error: "This document could not be found." }, { status: 404 });
    }

    const { data, error } = await getSupabaseAdmin()
      .storage.from("documents")
      .createSignedUrl(document.storage_path, 60);

    if (error) {
      console.error("Unable to create a temporary document download link:", error);
      return NextResponse.json(
        { error: "Unable to download this document right now." },
        { status: 502 },
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error("Unable to prepare document download:", error);
    return NextResponse.json(
      { error: "Unable to download this document right now." },
      { status: 503 },
    );
  }
}
