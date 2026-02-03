import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { AnalysisHistory } from '@/components/history/AnalysisHistory';

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <main className="flex-1 container py-8 md:py-12">
        <AnalysisHistory />
      </main>
    </div>
  );
}
