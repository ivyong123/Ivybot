import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      api: true,
      database: false,
    },
  };

  // Check database connection (non-blocking for health status)
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('trading_analysis_jobs').select('id').limit(1);
    health.checks.database = !error;
  } catch {
    health.checks.database = false;
  }

  // API is healthy as long as it can respond - database is optional
  const allChecksPass = Object.values(health.checks).every(Boolean);
  health.status = allChecksPass ? 'healthy' : 'degraded';

  // Always return 200 for Railway healthcheck - app is running
  return NextResponse.json(health, { status: 200 });
}
