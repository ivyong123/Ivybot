import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[History API] User auth check:', {
      hasUser: !!user,
      userId: user?.id?.slice(0, 8) + '...',
      authError: authError?.message,
    });

    if (authError || !user) {
      console.error('[History API] Auth failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data: jobs, error, count } = await supabase
      .from('trading_analysis_jobs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[History API] Query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    console.log('[History API] Returning:', {
      userId: user.id.slice(0, 8) + '...',
      jobsCount: jobs?.length || 0,
      total: count || 0,
    });

    return NextResponse.json({
      jobs: jobs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[History API] Exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
