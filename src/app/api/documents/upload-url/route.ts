import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const STORAGE_BUCKET = "documents";

export async function POST(request: Request) {
  let body: { filename?: unknown; size?: unknown };

  try {
    body = (await request.json()) as { filename?: unknown; size?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  if (
    typeof body.filename !== "string" ||
    !body.filename.toLowerCase().endsWith(".pdf") ||
    typeof body.size !== "number" ||
    !Number.isInteger(body.size) ||
    body.size <= 0 ||
    body.size > MAX_FILE_SIZE
  ) {
    return NextResponse.json(
      { error: "Choose a PDF file larger than 0 bytes and no larger than 20 MB." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const storagePath = `${randomUUID()}.pdf`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error("Unable to create a signed PDF upload URL:", error);
      return NextResponse.json(
        { error: "Unable to prepare the upload. Check your Supabase Storage setup." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      storagePath,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    console.error("Unable to prepare PDF upload:", error);
    return NextResponse.json(
      { error: "Unable to prepare the upload. Check your Supabase configuration." },
      { status: 503 },
    );
  }
}
