import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { AnalysisDashboard } from './dashboard';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <main className="flex-1 container py-8 md:py-12">
        <AnalysisDashboard />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 glass py-6">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>CheekyTrader AI - AI-powered trading analysis</p>
          <p>Data provided by Polygon, Benzinga, Finnhub, Unusual Whales</p>
        </div>
      </footer>
    </div>
  );
}
