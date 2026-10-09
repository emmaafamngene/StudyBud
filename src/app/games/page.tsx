import AppHeader from "@/components/ui/AppHeader";
import AppSidebar from "@/components/ui/AppSidebar";
import QuizRush from "@/features/games/components/QuizRush";
import { listDocuments } from "@/lib/documents/repository";

export default async function GamesPage() {
  const isConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
  let documents: Array<{ id: string; filename: string }> = [];
  let loadError: string | null = null;

  if (isConfigured) {
    try {
      ({ documents } = await listDocuments());
    } catch (error) {
      console.error("Unable to load documents for StudyBud Arena:", error);
      loadError = "Your study documents could not be loaded. Please refresh and try again.";
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6fc]">
      <AppSidebar active="games" />
      <div className="min-h-screen lg:pl-[220px]">
        <AppHeader active="games" />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-9">
          <QuizRush
            documents={documents}
            isConfigured={isConfigured}
            loadError={loadError}
          />
        </main>
      </div>
    </div>
  );
}
