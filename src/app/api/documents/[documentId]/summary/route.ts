import { NextResponse } from "next/server";
import { AIProviderError } from "@/lib/ai/gemini";
import { generateDocumentSummary } from "@/lib/ai/study-tools";
import { normalizeExtractedText } from "@/lib/documents/extracted-text";
import { getDocument } from "@/lib/documents/repository";

export const runtime = "nodejs";
export const maxDuration = 60;

const MINIMUM_WORD_COUNT = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  let document;
  try {
    document = await getDocument(documentId);
  } catch (error) {
    console.error("Unable to load document for summary:", error);
    return NextResponse.json(
      { error: "Unable to load this document. Please try again." },
      { status: 503 },
    );
  }

  if (!document) {
    return NextResponse.json({ error: "This study document could not be found." }, { status: 404 });
  }

  const extractedText = normalizeExtractedText(document.extracted_text);
  if (extractedText.split(/\s+/).filter(Boolean).length < MINIMUM_WORD_COUNT) {
    return NextResponse.json(
      { error: "This document does not contain enough readable text to create a useful summary." },
      { status: 422 },
    );
  }

  try {
    const summary = await generateDocumentSummary(extractedText);
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unexpected error while generating document summary:", error);
    return NextResponse.json(
      { error: "StudyBud couldn't create a summary. Please try again." },
      { status: 500 },
    );
  }
}
