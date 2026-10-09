import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createDocument, listDocuments } from "@/lib/documents/repository";
import { normalizeExtractedText } from "@/lib/documents/extracted-text";

export const runtime = "nodejs";

const STORAGE_BUCKET = "documents";

export async function GET() {
  try {
    const { documents, metadataAvailable } = await listDocuments();
    return NextResponse.json({ documents, metadataAvailable });
  } catch (error) {
    console.error("Unable to load documents:", error);
    return NextResponse.json(
      {
        error:
          "Unable to load documents. Verify your Supabase credentials and apply the documents migration.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  let body: { filename?: unknown; storagePath?: unknown; fileSizeBytes?: unknown };
  try {
    body = (await request.json()) as {
      filename?: unknown;
      storagePath?: unknown;
      fileSizeBytes?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid document request." }, { status: 400 });
  }

  if (
    typeof body.filename !== "string" ||
    !body.filename.toLowerCase().endsWith(".pdf") ||
    typeof body.storagePath !== "string" ||
    typeof body.fileSizeBytes !== "number" ||
    !Number.isInteger(body.fileSizeBytes) ||
    body.fileSizeBytes <= 0 ||
    body.fileSizeBytes > 20 * 1024 * 1024 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i.test(
      body.storagePath,
    )
  ) {
    return NextResponse.json(
      { error: "The document details are invalid. Please upload the PDF again." },
      { status: 400 },
    );
  }

  const storagePath = body.storagePath;

  try {
    const storage = getSupabaseAdmin().storage.from(STORAGE_BUCKET);
    const { data: file, error: downloadError } = await storage.download(storagePath);
    if (downloadError) {
      console.error("Unable to download uploaded PDF from Supabase Storage:", downloadError);
      return NextResponse.json(
        { error: "The uploaded PDF could not be found. Please upload it again." },
        { status: 422 },
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (
      fileBuffer.length === 0 ||
      fileBuffer.length > 20 * 1024 * 1024 ||
      fileBuffer.subarray(0, 5).toString() !== "%PDF-"
    ) {
      const { error: cleanupError } = await storage.remove([storagePath]);
      if (cleanupError) {
        console.error("Unable to remove invalid PDF from Supabase Storage:", cleanupError);
      }
      return NextResponse.json(
        { error: "The uploaded file is not a valid PDF up to 20 MB." },
        { status: 422 },
      );
    }

    let extractedText: string;
    const parser = new PDFParse({ data: fileBuffer });
    try {
      const parsedPdf = await parser.getText();
      extractedText = normalizeExtractedText(parsedPdf.text);
    } catch (error) {
      console.error("Unable to extract PDF text:", error);
      const { error: cleanupError } = await storage.remove([storagePath]);
      if (cleanupError) {
        console.error("Unable to remove unreadable PDF from Supabase Storage:", cleanupError);
      }
      return NextResponse.json(
        { error: "This PDF could not be read. Try another PDF file." },
        { status: 422 },
      );
    } finally {
      await parser.destroy();
    }

    if (!extractedText) {
      const { error: cleanupError } = await storage.remove([storagePath]);
      if (cleanupError) {
        console.error("Unable to remove textless PDF from Supabase Storage:", cleanupError);
      }
      return NextResponse.json(
        { error: "No selectable text was found in this PDF. Scanned PDFs are not supported yet." },
        { status: 422 },
      );
    }

    const document = await createDocument({
      filename: body.filename,
      storage_path: storagePath,
      extracted_text: extractedText,
      file_size_bytes: body.fileSizeBytes,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    try {
      const { error: cleanupError } = await getSupabaseAdmin()
        .storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);
      if (cleanupError) {
        console.error("Unable to remove orphaned PDF from Supabase Storage:", cleanupError);
      }
    } catch (cleanupError) {
      console.error("Unable to clean up uploaded PDF:", cleanupError);
    }
    console.error("Unable to save uploaded document:", error);
    return NextResponse.json(
      { error: "The PDF was read but could not be saved. Check your Supabase setup." },
      { status: 503 },
    );
  }
}
