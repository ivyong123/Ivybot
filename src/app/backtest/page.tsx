import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { BacktestDashboard } from '@/components/backtest/BacktestDashboard';

export default async function BacktestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <main className="flex-1 container py-8 md:py-12">
        <BacktestDashboard />
      </main>
    </div>
  );
}
