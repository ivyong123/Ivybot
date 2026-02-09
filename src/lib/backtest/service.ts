import { createAdminClient } from '@/lib/supabase/admin';
import { BacktestRecord, BacktestStats, BacktestSummary, PriceCheck } from '@/types/backtest';
import { TradeRecommendation } from '@/types/analysis';
import { getStockQuote } from '@/lib/providers/polygon';
import { getForexQuote } from '@/lib/providers/twelvedata';

// Filter options for backtest queries
export interface BacktestFilters {
  days?: number;           // Filter by last N days
  assetType?: 'stock' | 'forex' | 'all';  // Filter by asset type
  symbol?: string;         // Filter by specific symbol
  status?: 'pending' | 'won' | 'lost' | 'expired' | 'partial' | 'all';  // Filter by status
}

// Save a prediction for backtesting
export async function savePrediction(
  jobId: string,
  userId: string,
  recommendation: TradeRecommendation
): Promise<BacktestRecord | null> {
  const supabase = createAdminClient();

  // Calculate expiry date based on timeframe
  const expiryDate = calculateExpiryDate(recommendation.timeframe);

  // Get entry price, stop loss, and target - with forex_setup fallback
  let entryPrice = recommendation.entry_price || 0;
  let stopLoss = recommendation.stop_loss || 0;
  let targetPrice = recommendation.price_target || 0;

  // For forex, ensure we get values from forex_setup if top-level is missing
  if (recommendation.forex_setup?.trade) {
    const trade = recommendation.forex_setup.trade;
    if (!entryPrice || entryPrice === 0) {
      entryPrice = trade.entryPrice || 0;
    }
    if (!stopLoss || stopLoss === 0) {
      stopLoss = trade.stopLoss || 0;
    }
    // Use TP3 as the main target (extended target)
    if (!targetPrice || targetPrice === 0) {
      targetPrice = trade.takeProfit3 || trade.takeProfit2 || trade.takeProfit1 || 0;
    }
  }

  // For stock, ensure we get values from stock_result if top-level is missing
  if (recommendation.stock_result?.execution) {
    const exec = recommendation.stock_result.execution;
    if (!entryPrice || entryPrice === 0) {
      entryPrice = typeof exec.entryPrice === 'number' ? exec.entryPrice : parseFloat(String(exec.entryPrice)) || 0;
    }
    // stopLoss and profitTarget can be strings ("$185.50") or numbers (185.50) - handle both
    if ((!stopLoss || stopLoss === 0) && exec.stopLoss != null) {
      if (typeof exec.stopLoss === 'number') {
        stopLoss = exec.stopLoss;
      } else {
        const slMatch = String(exec.stopLoss).match(/\$?([\d.]+)/);
        if (slMatch) stopLoss = parseFloat(slMatch[1]);
      }
    }
    if ((!targetPrice || targetPrice === 0) && exec.profitTarget != null) {
      if (typeof exec.profitTarget === 'number') {
        targetPrice = exec.profitTarget;
      } else {
        const ptMatch = String(exec.profitTarget).match(/\$?([\d.]+)/);
        if (ptMatch) targetPrice = parseFloat(ptMatch[1]);
      }
    }
    // Fallback to breakeven
    if (!targetPrice || targetPrice === 0) {
      targetPrice = recommendation.stock_result.riskReward?.breakeven || 0;
    }
  }

  // For options/stock, use current price as entry if not set
  if ((!entryPrice || entryPrice === 0) && recommendation.current_price) {
    entryPrice = recommendation.current_price;
  }

  // Additional fallback: try stock_result.currentPrice
  if ((!entryPrice || entryPrice === 0) && recommendation.stock_result?.currentPrice) {
    entryPrice = recommendation.stock_result.currentPrice;
  }

  // Additional fallback: try to get current price from options strategy breakeven
  if ((!entryPrice || entryPrice === 0) && recommendation.options_strategy?.breakeven?.length) {
    entryPrice = recommendation.options_strategy.breakeven[0];
  }

  // For options strategies, derive stop/target from the strategy if not set
  if (recommendation.options_strategy && recommendation.current_price) {
    const currentPrice = recommendation.current_price;

    // If no stop loss, use 5% below entry for bullish, 5% above for bearish
    if (!stopLoss || stopLoss === 0) {
      const isBullish = ['strong_buy', 'buy'].includes(recommendation.recommendation);
      stopLoss = isBullish
        ? currentPrice * 0.95  // 5% stop loss for longs
        : currentPrice * 1.05; // 5% stop loss for shorts
    }

    // If no target, use price_target from options or derive from strategy
    if (!targetPrice || targetPrice === 0) {
      // Try to get breakeven from options strategy
      if (recommendation.options_strategy.breakeven?.length > 0) {
        targetPrice = recommendation.options_strategy.breakeven[0];
      } else {
        // Default: 10% target for bullish, -10% for bearish
        const isBullish = ['strong_buy', 'buy'].includes(recommendation.recommendation);
        targetPrice = isBullish
          ? currentPrice * 1.10
          : currentPrice * 0.90;
      }
    }
  }

  // Log what we're trying to save
  console.log('[Backtest] savePrediction called:', {
    symbol: recommendation.symbol,
    analysisType: recommendation.analysis_type,
    recommendation: recommendation.recommendation,
    entryPrice,
    stopLoss,
    targetPrice,
    currentPrice: recommendation.current_price,
    hasForexSetup: !!recommendation.forex_setup,
    hasStockResult: !!recommendation.stock_result,
    hasOptionsStrategy: !!recommendation.options_strategy,
  });

  // Skip saving if we don't have valid prices or if it's a "wait" recommendation
  if (recommendation.recommendation === 'wait' || recommendation.recommendation === 'hold') {
    console.log('[Backtest] Skipping save - recommendation is wait/hold');
    return null;
  }

  // Last resort: if we have a target but no entry for stocks, fetch live price
  if ((!entryPrice || entryPrice === 0) && recommendation.analysis_type === 'stock' && targetPrice > 0) {
    try {
      console.log(`[Backtest] No entry price for ${recommendation.symbol} - fetching live quote`);
      const quote = await getStockQuote(recommendation.symbol);
      if (quote?.price) {
        entryPrice = quote.price;
        console.log(`[Backtest] Got live price for entry: $${entryPrice}`);
      }
    } catch {
      console.warn(`[Backtest] Failed to fetch live price for ${recommendation.symbol}`);
    }
  }

  // For stock/options, we can save even with derived values
  // Only skip if we truly have no prices at all
  if (entryPrice === 0 && stopLoss === 0 && targetPrice === 0) {
    console.warn('[Backtest] Skipping save - all prices are 0:', { entryPrice, stopLoss, targetPrice });
    return null;
  }

  // If we have entry but missing stop/target, use defaults based on direction
  if (entryPrice > 0) {
    const isBullish = ['strong_buy', 'buy'].includes(recommendation.recommendation);
    if (stopLoss === 0) {
      stopLoss = isBullish ? entryPrice * 0.95 : entryPrice * 1.05;
      console.log('[Backtest] Derived stopLoss:', stopLoss);
    }
    if (targetPrice === 0) {
      targetPrice = isBullish ? entryPrice * 1.10 : entryPrice * 0.90;
      console.log('[Backtest] Derived targetPrice:', targetPrice);
    }
  }

  const record: Partial<BacktestRecord> = {
    job_id: jobId,
    user_id: userId,
    symbol: recommendation.symbol,
    analysis_type: recommendation.analysis_type as 'stock' | 'forex',
    prediction_date: new Date().toISOString(),
    predicted_direction: getDirection(recommendation.recommendation),
    entry_price: entryPrice,
    target_price: targetPrice,
    stop_loss: stopLoss,
    timeframe: recommendation.timeframe,
    expiry_date: expiryDate,
    confidence: recommendation.confidence,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Add options-specific fields
  if (recommendation.options_strategy) {
    record.options_strategy = recommendation.options_strategy.strategy_type;
    record.options_expiration = recommendation.options_strategy.legs?.[0]?.expiration;
  }

  // Add forex-specific fields (TP levels)
  if (recommendation.forex_setup?.trade) {
    record.tp1_price = recommendation.forex_setup.trade.takeProfit1;
    record.tp2_price = recommendation.forex_setup.trade.takeProfit2;
    record.tp3_price = recommendation.forex_setup.trade.takeProfit3;
  }

  const { data, error } = await supabase
    .from('backtest_records')
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('[Backtest] Failed to save prediction:', error.message, error.code, error.details, error.hint);
    console.error('[Backtest] Record that failed:', JSON.stringify(record, null, 2));
    return null;
  }

  console.log('[Backtest] Successfully saved prediction:', {
    id: data.id,
    symbol: data.symbol,
    direction: data.predicted_direction,
    entry: data.entry_price,
    target: data.target_price,
    stop: data.stop_loss,
  });

  return data;
}

// Check and update pending predictions
export async function checkPendingPredictions(): Promise<number> {
  const supabase = createAdminClient();

  // Get all pending predictions
  const { data: pending, error } = await supabase
    .from('backtest_records')
    .select('*')
    .eq('status', 'pending');

  if (error || !pending) {
    console.error('Failed to fetch pending predictions:', error);
    return 0;
  }

  let updatedCount = 0;

  for (const record of pending) {
    const updated = await checkAndUpdatePrediction(record);
    if (updated) updatedCount++;
  }

  return updatedCount;
}

// Check a single prediction against current price
async function checkAndUpdatePrediction(record: BacktestRecord): Promise<boolean> {
  const supabase = createAdminClient();

  try {
    // Get current price
    const priceData = await getCurrentPrice(record.symbol, record.analysis_type);
    if (!priceData) return false;

    const currentPrice = priceData.current_price;
    const entryPrice = record.entry_price;
    const targetPrice = record.target_price;
    const stopLoss = record.stop_loss;

    // Guard against invalid prices
    if (!entryPrice || entryPrice === 0 || !targetPrice || !stopLoss) {
      console.warn(`[Backtest] Invalid prices for ${record.symbol}: entry=${entryPrice}, target=${targetPrice}, stop=${stopLoss}`);
      return false;
    }

    const isBullish = record.predicted_direction === 'bullish';
    const now = new Date();
    const expiryDate = new Date(record.expiry_date);
    const isExpired = now > expiryDate;

    let status: BacktestRecord['status'] = 'pending';
    let hitTarget = false;
    let hitStop = false;
    let pnlPercent = 0;

    // Check if target hit
    if (isBullish) {
      hitTarget = currentPrice >= targetPrice;
      hitStop = currentPrice <= stopLoss;
      pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      hitTarget = currentPrice <= targetPrice;
      hitStop = currentPrice >= stopLoss;
      pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
    }

    // Guard against NaN
    if (isNaN(pnlPercent) || !isFinite(pnlPercent)) {
      pnlPercent = 0;
    }

    // For forex, check individual TPs
    let hitTp1 = false, hitTp2 = false, hitTp3 = false;
    if (record.analysis_type === 'forex' && record.tp1_price) {
      if (isBullish) {
        hitTp1 = currentPrice >= record.tp1_price;
        hitTp2 = record.tp2_price ? currentPrice >= record.tp2_price : false;
        hitTp3 = record.tp3_price ? currentPrice >= record.tp3_price : false;
      } else {
        hitTp1 = currentPrice <= record.tp1_price;
        hitTp2 = record.tp2_price ? currentPrice <= record.tp2_price : false;
        hitTp3 = record.tp3_price ? currentPrice <= record.tp3_price : false;
      }
    }

    // Determine final status
    if (hitTarget) {
      status = 'won';
    } else if (hitStop) {
      status = 'lost';
    } else if (hitTp1 && !hitTarget) {
      status = 'partial'; // Hit TP1 but not full target
    } else if (isExpired) {
      // Check if profitable at expiry
      status = pnlPercent > 0 ? 'won' : 'lost';
    }

    // Only update if status changed or expired
    if (status !== 'pending') {
      const { error } = await supabase
        .from('backtest_records')
        .update({
          status,
          actual_exit_price: currentPrice,
          actual_exit_date: new Date().toISOString(),
          pnl_percent: pnlPercent,
          hit_target: hitTarget,
          hit_stop: hitStop,
          hit_tp1: hitTp1,
          hit_tp2: hitTp2,
          hit_tp3: hitTp3,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      if (error) {
        console.error('Failed to update prediction:', error);
        return false;
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking prediction:', error);
    return false;
  }
}

// Get current price for a symbol
async function getCurrentPrice(symbol: string, type: 'stock' | 'forex'): Promise<PriceCheck | null> {
  try {
    if (type === 'forex') {
      const quote = await getForexQuote(symbol);
      if (quote && 'price' in quote) {
        return {
          symbol,
          current_price: Number(quote.price),
          high_since_entry: Number(quote.price),
          low_since_entry: Number(quote.price),
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      const quote = await getStockQuote(symbol);
      if (quote && 'price' in quote) {
        return {
          symbol,
          current_price: quote.price,
          high_since_entry: quote.price,
          low_since_entry: quote.price,
          timestamp: new Date().toISOString(),
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get price:', error);
    return null;
  }
}

// Calculate backtest statistics with optional filters
export async function getBacktestStats(userId: string, filters?: BacktestFilters): Promise<BacktestStats> {
  const supabase = createAdminClient();

  let query = supabase
    .from('backtest_records')
    .select('*')
    .eq('user_id', userId);

  // Apply filters
  if (filters?.days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.days);
    query = query.gte('created_at', cutoffDate.toISOString());
  }

  if (filters?.assetType && filters.assetType !== 'all') {
    query = query.eq('analysis_type', filters.assetType);
  }

  if (filters?.symbol) {
    query = query.eq('symbol', filters.symbol.toUpperCase());
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const { data: records, error } = await query.order('created_at', { ascending: false });

  console.log('[Backtest] getBacktestStats query result:', {
    userId,
    filters,
    recordsCount: records?.length || 0,
    error: error?.message,
  });

  if (error || !records) {
    console.error('[Backtest] getBacktestStats error or no records:', error);
    return getEmptyStats();
  }

  const completed = records.filter(r => r.status !== 'pending');
  const wins = completed.filter(r => r.status === 'won' || r.status === 'partial');
  const losses = completed.filter(r => r.status === 'lost');
  const pending = records.filter(r => r.status === 'pending');
  const expired = completed.filter(r => r.status === 'expired');

  const bullishTrades = records.filter(r => r.predicted_direction === 'bullish');
  const bearishTrades = records.filter(r => r.predicted_direction === 'bearish');
  const bullishWins = wins.filter(r => r.predicted_direction === 'bullish');
  const bearishWins = wins.filter(r => r.predicted_direction === 'bearish');

  const highConfTrades = records.filter(r => r.confidence >= 70);
  const highConfWins = wins.filter(r => r.confidence >= 70);
  const lowConfTrades = records.filter(r => r.confidence < 70);
  const lowConfWins = wins.filter(r => r.confidence < 70);

  const avgWinPercent = wins.length > 0
    ? wins.reduce((sum, r) => sum + (r.pnl_percent || 0), 0) / wins.length
    : 0;

  const avgLossPercent = losses.length > 0
    ? Math.abs(losses.reduce((sum, r) => sum + (r.pnl_percent || 0), 0) / losses.length)
    : 0;

  const totalWinAmount = wins.reduce((sum, r) => sum + (r.pnl_percent || 0), 0);
  const totalLossAmount = Math.abs(losses.reduce((sum, r) => sum + (r.pnl_percent || 0), 0));

  // Calculate average trade duration
  const completedWithDates = completed.filter(r => r.actual_exit_date);
  const avgDuration = completedWithDates.length > 0
    ? completedWithDates.reduce((sum, r) => {
        const start = new Date(r.prediction_date);
        const end = new Date(r.actual_exit_date!);
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / completedWithDates.length
    : 0;

  // Last 10 trades
  const last10 = completed.slice(0, 10);
  const last10Wins = last10.filter(r => r.status === 'won' || r.status === 'partial');

  // Last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30Days = completed.filter(r => new Date(r.created_at) >= thirtyDaysAgo);
  const last30DaysWins = last30Days.filter(r => r.status === 'won' || r.status === 'partial');

  // Best/worst trades
  const sortedByPnl = [...completed].sort((a, b) => (b.pnl_percent || 0) - (a.pnl_percent || 0));
  const bestTrade = sortedByPnl[0];
  const worstTrade = sortedByPnl[sortedByPnl.length - 1];

  // Best/worst symbols
  const symbolStats: Record<string, { wins: number; losses: number }> = {};
  completed.forEach(r => {
    if (!symbolStats[r.symbol]) symbolStats[r.symbol] = { wins: 0, losses: 0 };
    if (r.status === 'won' || r.status === 'partial') symbolStats[r.symbol].wins++;
    else symbolStats[r.symbol].losses++;
  });

  const symbolRates = Object.entries(symbolStats)
    .map(([symbol, stats]) => ({
      symbol,
      winRate: stats.wins / (stats.wins + stats.losses),
      total: stats.wins + stats.losses,
    }))
    .filter(s => s.total >= 3) // At least 3 trades
    .sort((a, b) => b.winRate - a.winRate);

  return {
    total_trades: records.length,
    winning_trades: wins.length,
    losing_trades: losses.length,
    pending_trades: pending.length,
    expired_trades: expired.length,
    win_rate: completed.length > 0 ? (wins.length / completed.length) * 100 : 0,
    avg_win_percent: avgWinPercent,
    avg_loss_percent: avgLossPercent,
    profit_factor: totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount,
    bullish_trades: bullishTrades.length,
    bullish_wins: bullishWins.length,
    bearish_trades: bearishTrades.length,
    bearish_wins: bearishWins.length,
    high_confidence_trades: highConfTrades.length,
    high_confidence_wins: highConfWins.length,
    low_confidence_trades: lowConfTrades.length,
    low_confidence_wins: lowConfWins.length,
    avg_trade_duration_days: avgDuration,
    last_10_trades_win_rate: last10.length > 0 ? (last10Wins.length / last10.length) * 100 : 0,
    last_30_days_win_rate: last30Days.length > 0 ? (last30DaysWins.length / last30Days.length) * 100 : 0,
    best_trade_percent: bestTrade?.pnl_percent || 0,
    worst_trade_percent: worstTrade?.pnl_percent || 0,
    best_symbol: symbolRates[0]?.symbol || 'N/A',
    worst_symbol: symbolRates[symbolRates.length - 1]?.symbol || 'N/A',
  };
}

// Get full backtest summary with optional filters
export async function getBacktestSummary(userId: string, filters?: BacktestFilters): Promise<BacktestSummary> {
  const supabase = createAdminClient();
  const stats = await getBacktestStats(userId, filters);

  let query = supabase
    .from('backtest_records')
    .select('*')
    .eq('user_id', userId);

  // Apply same filters
  if (filters?.days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.days);
    query = query.gte('created_at', cutoffDate.toISOString());
  }

  if (filters?.assetType && filters.assetType !== 'all') {
    query = query.eq('analysis_type', filters.assetType);
  }

  if (filters?.symbol) {
    query = query.eq('symbol', filters.symbol.toUpperCase());
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const { data: records } = await query
    .order('created_at', { ascending: false })
    .limit(100);

  const recentTrades = records || [];

  // Group by symbol - only count completed trades for win/loss stats
  const bySymbol: Record<string, { trades: number; wins: number; losses: number; pending: number; win_rate: number }> = {};
  recentTrades.forEach(r => {
    if (!bySymbol[r.symbol]) bySymbol[r.symbol] = { trades: 0, wins: 0, losses: 0, pending: 0, win_rate: 0 };
    bySymbol[r.symbol].trades++;
    if (r.status === 'won' || r.status === 'partial') bySymbol[r.symbol].wins++;
    else if (r.status === 'lost') bySymbol[r.symbol].losses++;
    else bySymbol[r.symbol].pending++;
  });
  Object.values(bySymbol).forEach(s => {
    const completed = s.wins + s.losses;
    s.win_rate = completed > 0 ? (s.wins / completed) * 100 : 0;
  });

  // Group by strategy
  const byStrategy: Record<string, { trades: number; wins: number; win_rate: number }> = {};
  recentTrades.filter(r => r.options_strategy).forEach(r => {
    const strat = r.options_strategy!;
    if (!byStrategy[strat]) byStrategy[strat] = { trades: 0, wins: 0, win_rate: 0 };
    byStrategy[strat].trades++;
    if (r.status === 'won' || r.status === 'partial') byStrategy[strat].wins++;
  });
  Object.values(byStrategy).forEach(s => {
    s.win_rate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
  });

  // Monthly performance
  const monthlyMap = new Map<string, { trades: number; wins: number; pnl: number }>();
  recentTrades.forEach(r => {
    const month = r.created_at.slice(0, 7); // YYYY-MM
    if (!monthlyMap.has(month)) monthlyMap.set(month, { trades: 0, wins: 0, pnl: 0 });
    const m = monthlyMap.get(month)!;
    m.trades++;
    if (r.status === 'won' || r.status === 'partial') m.wins++;
    m.pnl += r.pnl_percent || 0;
  });

  const monthlyPerformance = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      trades: data.trades,
      wins: data.wins,
      win_rate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      total_pnl_percent: data.pnl,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    stats,
    recent_trades: recentTrades,
    by_symbol: bySymbol,
    by_strategy: byStrategy,
    monthly_performance: monthlyPerformance,
  };
}

// Export backtest data to CSV format
export async function exportBacktestData(userId: string, filters?: BacktestFilters): Promise<string> {
  const supabase = createAdminClient();

  let query = supabase
    .from('backtest_records')
    .select('*')
    .eq('user_id', userId);

  // Apply filters
  if (filters?.days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.days);
    query = query.gte('created_at', cutoffDate.toISOString());
  }

  if (filters?.assetType && filters.assetType !== 'all') {
    query = query.eq('analysis_type', filters.assetType);
  }

  if (filters?.symbol) {
    query = query.eq('symbol', filters.symbol.toUpperCase());
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const { data: records, error } = await query.order('created_at', { ascending: false });

  if (error || !records || records.length === 0) {
    return 'No data to export';
  }

  // CSV headers
  const headers = [
    'Date',
    'Symbol',
    'Type',
    'Direction',
    'Entry Price',
    'Target Price',
    'Stop Loss',
    'Confidence',
    'Status',
    'Exit Price',
    'P&L %',
    'Timeframe',
    'Strategy',
  ];

  // CSV rows
  const rows = records.map(r => [
    new Date(r.prediction_date).toLocaleDateString(),
    r.symbol,
    r.analysis_type,
    r.predicted_direction,
    r.entry_price?.toFixed(r.analysis_type === 'forex' ? 5 : 2) || '',
    r.target_price?.toFixed(r.analysis_type === 'forex' ? 5 : 2) || '',
    r.stop_loss?.toFixed(r.analysis_type === 'forex' ? 5 : 2) || '',
    r.confidence?.toString() || '',
    r.status,
    r.actual_exit_price?.toFixed(r.analysis_type === 'forex' ? 5 : 2) || '',
    r.pnl_percent?.toFixed(2) || '',
    r.timeframe || '',
    r.options_strategy || '',
  ]);

  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csv;
}

// Get list of unique symbols for filter dropdown
export async function getBacktestSymbols(userId: string): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: records } = await supabase
    .from('backtest_records')
    .select('symbol')
    .eq('user_id', userId);

  if (!records) return [];

  // Get unique symbols
  const symbols = [...new Set(records.map(r => r.symbol))].sort();
  return symbols;
}

// Backfill missing backtest records from completed analysis jobs
export async function backfillPredictions(userId: string): Promise<{ created: number; skipped: number; errors: number; details: string[] }> {
  const supabase = createAdminClient();
  let created = 0;
  let skipped = 0;
  let errors = 0;
  const details: string[] = [];

  // Get all completed analysis jobs for this user
  const { data: jobs, error: jobsError } = await supabase
    .from('trading_analysis_jobs')
    .select('id, symbol, analysis_type, final_result, created_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('final_result', 'is', null)
    .order('created_at', { ascending: false });

  if (jobsError || !jobs) {
    const msg = `Failed to fetch jobs: ${jobsError?.message || 'null result'}`;
    console.error('[Backfill]', msg);
    details.push(msg);
    return { created: 0, skipped: 0, errors: 1, details };
  }

  details.push(`Found ${jobs.length} completed jobs`);
  console.log(`[Backfill] Found ${jobs.length} completed jobs for user ${userId.slice(0, 8)}...`);

  if (jobs.length > 0) {
    // Log first 3 jobs for debugging
    for (let i = 0; i < Math.min(3, jobs.length); i++) {
      const j = jobs[i];
      let fr = j.final_result;

      // Handle JSON string final_result
      if (typeof fr === 'string') {
        try { fr = JSON.parse(fr); } catch { /* not valid JSON string */ }
      }

      const info = `Job ${j.id.slice(0, 8)}: symbol=${j.symbol}, fr_type=${typeof j.final_result}, rec=${fr?.recommendation || 'none'}, fr_symbol=${fr?.symbol || 'none'}`;
      console.log(`[Backfill] ${info}`);
      details.push(info);
    }
  }

  // Get existing backtest records to avoid duplicates
  const { data: existingRecords } = await supabase
    .from('backtest_records')
    .select('job_id')
    .eq('user_id', userId);

  const existingJobIds = new Set((existingRecords || []).map(r => r.job_id));
  details.push(`${existingJobIds.size} existing backtest records`);
  console.log(`[Backfill] ${existingJobIds.size} existing backtest records found`);

  for (const job of jobs) {
    // Skip if already has a backtest record
    if (existingJobIds.has(job.id)) {
      skipped++;
      continue;
    }

    // Parse final_result - handle case where it's stored as a JSON string
    let recommendation = job.final_result;
    if (typeof recommendation === 'string') {
      try {
        recommendation = JSON.parse(recommendation);
        console.log(`[Backfill] Parsed string final_result for job ${job.id.slice(0, 8)}`);
      } catch {
        details.push(`Job ${job.id.slice(0, 8)}: final_result is unparseable string`);
        skipped++;
        continue;
      }
    }

    if (!recommendation || !recommendation.symbol) {
      // If no symbol in final_result, try using the job's symbol
      if (recommendation && job.symbol) {
        recommendation.symbol = job.symbol;
        recommendation.analysis_type = recommendation.analysis_type || job.analysis_type;
        console.log(`[Backfill] Patched missing symbol from job: ${job.symbol}`);
      } else {
        details.push(`Job ${job.id.slice(0, 8)}: no recommendation or symbol (rec=${recommendation?.recommendation})`);
        skipped++;
        continue;
      }
    }

    // Ensure analysis_type is set
    if (!recommendation.analysis_type) {
      recommendation.analysis_type = job.analysis_type;
    }

    // Skip wait/hold
    if (recommendation.recommendation === 'wait' || recommendation.recommendation === 'hold') {
      details.push(`Job ${job.id.slice(0, 8)} (${recommendation.symbol}): skipped - ${recommendation.recommendation}`);
      skipped++;
      continue;
    }

    try {
      const saved = await savePrediction(job.id, userId, recommendation);
      if (saved) {
        created++;
        details.push(`Job ${job.id.slice(0, 8)} (${recommendation.symbol}): CREATED`);
        console.log(`[Backfill] Created record for ${recommendation.symbol} (${job.id})`);
      } else {
        details.push(`Job ${job.id.slice(0, 8)} (${recommendation.symbol}): savePrediction returned null`);
        skipped++;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      details.push(`Job ${job.id.slice(0, 8)} (${recommendation.symbol}): ERROR - ${errMsg}`);
      console.error(`[Backfill] Error saving ${recommendation.symbol}:`, err);
      errors++;
    }
  }

  // Repair existing records with wrong 'neutral' direction
  const { data: neutralRecords } = await supabase
    .from('backtest_records')
    .select('id, job_id')
    .eq('user_id', userId)
    .eq('predicted_direction', 'neutral');

  if (neutralRecords && neutralRecords.length > 0) {
    console.log(`[Backfill] Repairing ${neutralRecords.length} records with neutral direction`);
    for (const record of neutralRecords) {
      // Look up the original recommendation from the job
      const { data: jobData } = await supabase
        .from('trading_analysis_jobs')
        .select('final_result')
        .eq('id', record.job_id)
        .single();

      if (jobData?.final_result?.recommendation) {
        const correctDirection = getDirection(jobData.final_result.recommendation);
        if (correctDirection !== 'neutral') {
          await supabase
            .from('backtest_records')
            .update({ predicted_direction: correctDirection, updated_at: new Date().toISOString() })
            .eq('id', record.id);
          console.log(`[Backfill] Fixed direction for record ${record.id}: neutral → ${correctDirection}`);
        }
      }
    }
  }

  console.log(`[Backfill] Done: created=${created}, skipped=${skipped}, errors=${errors}`);
  return { created, skipped, errors, details };
}

// Helper functions
function calculateExpiryDate(timeframe: string): string {
  const now = new Date();
  const match = timeframe.match(/(\d+)\s*(week|day|month)/i);

  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.includes('week')) {
      now.setDate(now.getDate() + num * 7);
    } else if (unit.includes('day')) {
      now.setDate(now.getDate() + num);
    } else if (unit.includes('month')) {
      now.setMonth(now.getMonth() + num);
    }
  } else {
    // Default to 4 weeks
    now.setDate(now.getDate() + 28);
  }

  return now.toISOString();
}

function getDirection(recommendation: string): 'bullish' | 'bearish' | 'neutral' {
  const rec = (recommendation || '').toLowerCase().trim();
  if (['strong_buy', 'buy', 'strong buy', 'moderate_buy'].includes(rec)) return 'bullish';
  if (['strong_sell', 'sell', 'strong sell', 'moderate_sell'].includes(rec)) return 'bearish';
  return 'neutral';
}

function getEmptyStats(): BacktestStats {
  return {
    total_trades: 0,
    winning_trades: 0,
    losing_trades: 0,
    pending_trades: 0,
    expired_trades: 0,
    win_rate: 0,
    avg_win_percent: 0,
    avg_loss_percent: 0,
    profit_factor: 0,
    bullish_trades: 0,
    bullish_wins: 0,
    bearish_trades: 0,
    bearish_wins: 0,
    high_confidence_trades: 0,
    high_confidence_wins: 0,
    low_confidence_trades: 0,
    low_confidence_wins: 0,
    avg_trade_duration_days: 0,
    last_10_trades_win_rate: 0,
    last_30_days_win_rate: 0,
    best_trade_percent: 0,
    worst_trade_percent: 0,
    best_symbol: 'N/A',
    worst_symbol: 'N/A',
  };
}
