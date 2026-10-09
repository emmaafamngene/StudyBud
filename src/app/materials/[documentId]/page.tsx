import { notFound } from "next/navigation";
import StudyWorkspace from "@/features/study/components/StudyWorkspace";
import { getDocument } from "@/lib/documents/repository";
import { normalizeExtractedText } from "@/lib/documents/extracted-text";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface StudyPageProps {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ tool?: string }>;
}

export default async function StudyPage({ params, searchParams }: StudyPageProps) {
  const { documentId } = await params;
  const { tool } = await searchParams;
  const document = await getDocument(documentId);

  if (!document) {
    notFound();
  }

  const { data: preview, error: previewError } = await getSupabaseAdmin()
    .storage.from("documents")
    .createSignedUrl(document.storage_path, 60 * 60);
  if (previewError) {
    console.error("Unable to create a temporary PDF preview link:", previewError.message);
  }

  const extractedText = normalizeExtractedText(document.extracted_text);
  const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
  const initialTab = tool === "quiz" || tool === "summary" || tool === "map" ? tool : "study";

  return (
    <StudyWorkspace
      documentId={document.id}
      filename={document.filename}
      createdAtLabel={new Date(document.created_at).toLocaleDateString()}
      previewUrl={preview?.signedUrl ?? null}
      previewError={previewError ? "The PDF preview could not be opened. You can still read the extracted notes." : null}
      extractedText={extractedText}
      wordCount={wordCount}
      initialTab={initialTab}
    />
  );
}
