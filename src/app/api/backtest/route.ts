import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBacktestSummary, checkPendingPredictions, getBacktestSymbols, backfillPredictions, BacktestFilters } from '@/lib/backtest';

// GET - Get backtest statistics with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[Backtest API] User auth check:', {
      hasUser: !!user,
      userId: user?.id?.slice(0, 8) + '...',
      authError: authError?.message,
    });

    if (authError || !user) {
      console.error('[Backtest API] Auth failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Check if refresh is requested
    const refresh = searchParams.get('refresh') === 'true';

    if (refresh) {
      // Backfill any missing predictions from completed analyses
      const backfill = await backfillPredictions(user.id);
      if (backfill.created > 0) {
        console.log(`[Backtest] Backfilled ${backfill.created} missing predictions`);
      }

      // Check and update pending predictions
      const updated = await checkPendingPredictions();
      console.log(`[Backtest] Updated ${updated} predictions`);
    }

    // Check if symbols list is requested
    if (searchParams.get('symbols') === 'true') {
      const symbols = await getBacktestSymbols(user.id);
      return NextResponse.json({ symbols });
    }

    // Always backfill missing predictions (fast - skips existing records)
    let backfillResult = { created: 0, skipped: 0, errors: 0, details: [] as string[] };
    let backfillError: string | null = null;
    try {
      backfillResult = await backfillPredictions(user.id);
      if (backfillResult.created > 0) {
        console.log(`[Backtest] Auto-backfilled ${backfillResult.created} missing predictions for user ${user.id.slice(0, 8)}...`);
      }
    } catch (backfillErr) {
      backfillError = backfillErr instanceof Error ? backfillErr.message : String(backfillErr);
      console.error('[Backtest] Backfill error (non-fatal):', backfillErr);
    }

    // Parse filters from query params
    const filters: BacktestFilters = {};

    const days = searchParams.get('days');
    if (days) {
      filters.days = parseInt(days, 10);
    }

    const assetType = searchParams.get('assetType');
    if (assetType && ['stock', 'forex', 'all'].includes(assetType)) {
      filters.assetType = assetType as 'stock' | 'forex' | 'all';
    }

    const symbol = searchParams.get('symbol');
    if (symbol) {
      filters.symbol = symbol;
    }

    const status = searchParams.get('status');
    if (status && ['pending', 'won', 'lost', 'expired', 'partial', 'all'].includes(status)) {
      filters.status = status as BacktestFilters['status'];
    }

    // Get backtest summary with filters
    const summary = await getBacktestSummary(user.id, filters);

    console.log('[Backtest API] Summary stats:', {
      totalTrades: summary.stats.total_trades,
      winRate: summary.stats.win_rate,
      pendingTrades: summary.stats.pending_trades,
      recentTradesCount: summary.recent_trades.length,
    });

    return NextResponse.json({
      ...summary,
      _debug: {
        backfill: backfillResult,
        backfillError,
        userId: user.id.slice(0, 8) + '...',
      },
    });
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
