import { createAdminClient } from '@/lib/supabase/admin';
import { BacktestRecord, BacktestStats, BacktestSummary, PriceCheck } from '@/types/backtest';
import { TradeRecommendation } from '@/types/analysis';
import { getStockQuote } from '@/lib/providers/polygon';
import { getForexQuote } from '@/lib/providers/twelvedata';

// Save a prediction for backtesting
export async function savePrediction(
  jobId: string,
  userId: string,
  recommendation: TradeRecommendation
): Promise<BacktestRecord | null> {
  const supabase = createAdminClient();

  // Calculate expiry date based on timeframe
  const expiryDate = calculateExpiryDate(recommendation.timeframe);

  const record: Partial<BacktestRecord> = {
    job_id: jobId,
    user_id: userId,
    symbol: recommendation.symbol,
    analysis_type: recommendation.analysis_type as 'stock' | 'forex',
    prediction_date: new Date().toISOString(),
    predicted_direction: getDirection(recommendation.recommendation),
    entry_price: recommendation.entry_price || 0,
    target_price: recommendation.price_target || 0,
    stop_loss: recommendation.stop_loss || 0,
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

  // Add forex-specific fields
  if (recommendation.forex_setup) {
    record.tp1_price = recommendation.forex_setup.trade?.takeProfit1;
    record.tp2_price = recommendation.forex_setup.trade?.takeProfit2;
    record.tp3_price = recommendation.forex_setup.trade?.takeProfit3;
  }

  const { data, error } = await supabase
    .from('backtest_records')
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('Failed to save prediction:', error);
    return null;
  }

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

// Calculate backtest statistics
export async function getBacktestStats(userId: string): Promise<BacktestStats> {
  const supabase = createAdminClient();

  const { data: records, error } = await supabase
    .from('backtest_records')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !records) {
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

// Get full backtest summary
export async function getBacktestSummary(userId: string): Promise<BacktestSummary> {
  const supabase = createAdminClient();
  const stats = await getBacktestStats(userId);

  const { data: records } = await supabase
    .from('backtest_records')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const recentTrades = records || [];

  // Group by symbol
  const bySymbol: Record<string, { trades: number; wins: number; win_rate: number }> = {};
  recentTrades.forEach(r => {
    if (!bySymbol[r.symbol]) bySymbol[r.symbol] = { trades: 0, wins: 0, win_rate: 0 };
    bySymbol[r.symbol].trades++;
    if (r.status === 'won' || r.status === 'partial') bySymbol[r.symbol].wins++;
  });
  Object.values(bySymbol).forEach(s => {
    s.win_rate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
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
  if (['strong_buy', 'buy'].includes(recommendation)) return 'bullish';
  if (['strong_sell', 'sell'].includes(recommendation)) return 'bearish';
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
