import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBacktestSummary, checkPendingPredictions } from '@/lib/backtest';

// GET - Get backtest statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if refresh is requested
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

    if (refresh) {
      // Check and update pending predictions
      const updated = await checkPendingPredictions();
      console.log(`[Backtest] Updated ${updated} predictions`);
    }

    // Get backtest summary
    const summary = await getBacktestSummary(user.id);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Backtest API error:', error);
    return NextResponse.json(
      { error: 'Failed to get backtest data' },
      { status: 500 }
    );
  }
}

// POST - Manually trigger prediction check
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updated = await checkPendingPredictions();

    return NextResponse.json({
      message: `Updated ${updated} predictions`,
      updated_count: updated,
    });
  } catch (error) {
    console.error('Backtest update error:', error);
    return NextResponse.json(
      { error: 'Failed to update predictions' },
      { status: 500 }
    );
  }
}
