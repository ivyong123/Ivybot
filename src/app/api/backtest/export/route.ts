import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportBacktestData, BacktestFilters } from '@/lib/backtest';

// GET - Export backtest data as CSV
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

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

    // Generate CSV
    const csv = await exportBacktestData(user.id, filters);

    // Create filename with date
    const date = new Date().toISOString().split('T')[0];
    const filename = `backtest-report-${date}.csv`;

    // Return as downloadable file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Backtest export error:', error);
    return NextResponse.json(
      { error: 'Failed to export backtest data' },
      { status: 500 }
    );
  }
}
