import DocumentsHome from "@/features/documents/components/DocumentsHome";

export default function DocumentsPage() {
  const isConfigured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  );

  return <DocumentsHome isConfigured={isConfigured} />;
}
