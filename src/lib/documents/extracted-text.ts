export function normalizeExtractedText(text: string): string {
  return text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
}
