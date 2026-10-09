import HomeDashboard from "@/features/documents/components/HomeDashboard";

export default function HomePage() {
  const isConfigured = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  );

  return <HomeDashboard isConfigured={isConfigured} />;
}
