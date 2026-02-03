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

  // Check database connection
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('trading_analysis_jobs').select('id').limit(1);
    health.checks.database = !error;
  } catch {
    health.checks.database = false;
  }

  // Determine overall status
  const allChecksPass = Object.values(health.checks).every(Boolean);
  health.status = allChecksPass ? 'healthy' : 'degraded';

  const statusCode = allChecksPass ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
