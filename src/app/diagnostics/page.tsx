import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { DiagnosticsPanel } from '@/components/diagnostics/DiagnosticsPanel';
import { redirect } from 'next/navigation';

export default async function DiagnosticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <main className="flex-1 container py-8 md:py-12">
        <DiagnosticsPanel />
      </main>
    </div>
  );
}
