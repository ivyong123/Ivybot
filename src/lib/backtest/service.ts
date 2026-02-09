import { createAdminClient } from '@/lib/supabase/admin';
import { BacktestRecord, BacktestStats, BacktestSummary, PriceCheck } from '@/types/backtest';
import { TradeRecommendation } from '@/types/analysis';
import { getStockQuote } from '@/lib/providers/polygon';
import { getForexQuote } from '@/lib/providers/twelvedata';

export interface BacktestFilters {
  days?: number;
  assetType?: 'stock' | 'forex' | 'all';
  symbol?: string;
  status?: 'pending' | 'won' | 'lost' | 'expired' | 'partial' | 'all';
}

// ============================================================
// CORE: Save a prediction for backtesting
// Design: ALWAYS succeed for actionable recommendations.
// Fetch live prices as primary source, use stored prices as bonus.
// ============================================================
export async function savePrediction(
  jobId: string,
  userId: string,
  rec: TradeRecommendation
): Promise<BacktestRecord | null> {
  // 1. Skip non-actionable recommendations
  const action = (rec.recommendation || '').toLowerCase();
  if (action === 'wait' || action === 'hold') {
    console.log(`[Backtest] Skip ${rec.symbol}: ${action}`);
    return null;
  }

  const isBullish = ['strong_buy', 'buy', 'moderate_buy', 'strong buy'].includes(action);
  const direction: 'bullish' | 'bearish' = isBullish ? 'bullish' : 'bearish';
  const analysisType = (rec.analysis_type === 'forex' ? 'forex' : 'stock') as 'stock' | 'forex';

  // 2. Gather ALL possible price sources
  let entry = toNum(rec.entry_price) || toNum(rec.current_price);
  let target = toNum(rec.price_target);
  let stop = toNum(rec.stop_loss);

  // Try nested forex data
  if (rec.forex_setup?.trade) {
    const t = rec.forex_setup.trade;
    if (!entry) entry = toNum(t.entryPrice);
    if (!stop) stop = toNum(t.stopLoss);
    if (!target) target = toNum(t.takeProfit3) || toNum(t.takeProfit2) || toNum(t.takeProfit1);
  }
  // Try forex_setup.currentPrice
  if (!entry && rec.forex_setup?.currentPrice) {
    entry = toNum(rec.forex_setup.currentPrice);
  }

  // Try nested stock data
  if (rec.stock_result?.execution) {
    const e = rec.stock_result.execution;
    if (!entry) entry = toNum(e.entryPrice);
    if (!stop) stop = parsePrice(e.stopLoss);
    if (!target) target = parsePrice(e.profitTarget);
  }
  if (!entry && rec.stock_result?.currentPrice) {
    entry = toNum(rec.stock_result.currentPrice);
  }

  // Try options strategy
  if (rec.options_strategy?.breakeven?.length) {
    if (!entry) entry = toNum(rec.options_strategy.breakeven[0]);
  }

  // 3. ALWAYS fetch live price if we still don't have entry
  if (!entry) {
    entry = await fetchLivePrice(rec.symbol, analysisType);
  }

  // 4. If we STILL have no entry, we truly can't save
  if (!entry) {
    console.warn(`[Backtest] SKIP ${rec.symbol}: no price available at all`);
    return null;
  }

  // 5. Derive missing stop/target from entry price
  if (!stop) {
    stop = isBullish ? entry * 0.95 : entry * 1.05;
  }
  if (!target) {
    target = isBullish ? entry * 1.10 : entry * 0.90;
  }

  // 6. Build the record
  const record: Partial<BacktestRecord> = {
    job_id: jobId,
    user_id: userId,
    symbol: rec.symbol,
    analysis_type: analysisType,
    prediction_date: new Date().toISOString(),
    predicted_direction: direction,
    entry_price: entry,
    target_price: target,
    stop_loss: stop,
    timeframe: rec.timeframe || '4 weeks',
    expiry_date: calculateExpiryDate(rec.timeframe || '4 weeks'),
    confidence: rec.confidence || 50,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Optional fields
  if (rec.options_strategy) {
    record.options_strategy = rec.options_strategy.strategy_type;
    record.options_expiration = rec.options_strategy.legs?.[0]?.expiration;
  }
  if (rec.forex_setup?.trade) {
    record.tp1_price = rec.forex_setup.trade.takeProfit1;
    record.tp2_price = rec.forex_setup.trade.takeProfit2;
    record.tp3_price = rec.forex_setup.trade.takeProfit3;
  }

  console.log(`[Backtest] Saving ${rec.symbol}: ${direction} entry=${entry} target=${target} stop=${stop}`);

  // 7. Insert
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('backtest_records')
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error(`[Backtest] INSERT FAILED for ${rec.symbol}:`, error.message, error.code, error.details, error.hint);
    return null;
  }

  console.log(`[Backtest] SAVED ${rec.symbol} (id: ${data.id})`);
  return data;
}

// ============================================================
// BACKFILL: Create backtest records from completed analysis jobs
// ============================================================
export async function backfillPredictions(userId: string): Promise<{ created: number; skipped: number; errors: number; details: string[] }> {
  const supabase = createAdminClient();
  const details: string[] = [];
  let created = 0, skipped = 0, errors = 0;

  // 1. Get completed jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('trading_analysis_jobs')
    .select('id, symbol, analysis_type, final_result, created_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('final_result', 'is', null)
    .order('created_at', { ascending: false });

  if (jobsError || !jobs) {
    const msg = `Failed to fetch jobs: ${jobsError?.message || 'no data'}`;
    details.push(msg);
    return { created: 0, skipped: 0, errors: 1, details };
  }

  details.push(`Found ${jobs.length} completed jobs`);

  // 2. Get existing backtest record job IDs
  const { data: existing } = await supabase
    .from('backtest_records')
    .select('job_id')
    .eq('user_id', userId);

  const existingIds = new Set((existing || []).map(r => r.job_id));
  details.push(`${existingIds.size} existing backtest records`);

  // 3. Process each job
  for (const job of jobs) {
    if (existingIds.has(job.id)) {
      skipped++;
      continue;
    }

    // Parse final_result (handle string or object)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rec: any = job.final_result;
    if (typeof rec === 'string') {
      try { rec = JSON.parse(rec); } catch {
        details.push(`${job.symbol}: unparseable final_result`);
        skipped++;
        continue;
      }
    }

    if (!rec) {
      details.push(`${job.symbol}: null final_result`);
      skipped++;
      continue;
    }

    // Patch missing fields from job
    if (!rec.symbol) rec.symbol = job.symbol;
    if (!rec.analysis_type) rec.analysis_type = job.analysis_type;

    const action = (rec.recommendation || '').toLowerCase();

    // Log every job for diagnostics
    details.push(`${job.symbol}: rec=${rec.recommendation}, entry=${rec.entry_price || 'none'}, price=${rec.current_price || 'none'}`);

    if (action === 'wait' || action === 'hold') {
      skipped++;
      continue;
    }

    try {
      const saved = await savePrediction(job.id, userId, rec);
      if (saved) {
        created++;
        details.push(`${job.symbol}: CREATED (entry=${saved.entry_price})`);
      } else {
        details.push(`${job.symbol}: save returned null`);
        skipped++;
      }
    } catch (err) {
      details.push(`${job.symbol}: ERROR - ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  details.push(`Result: created=${created}, skipped=${skipped}, errors=${errors}`);
  return { created, skipped, errors, details };
}

// ============================================================
// CHECK: Update pending predictions against current prices
// ============================================================
export async function checkPendingPredictions(): Promise<number> {
  const supabase = createAdminClient();
  const { data: pending, error } = await supabase
    .from('backtest_records')
    .select('*')
    .eq('status', 'pending');

  if (error || !pending) return 0;

  let updated = 0;
  for (const record of pending) {
    if (await checkAndUpdatePrediction(record)) updated++;
  }
  return updated;
}

async function checkAndUpdatePrediction(record: BacktestRecord): Promise<boolean> {
  const supabase = createAdminClient();

  try {
    const priceData = await getCurrentPrice(record.symbol, record.analysis_type);
    if (!priceData) return false;

    const current = priceData.current_price;
    const { entry_price: entry, target_price: target, stop_loss: stop } = record;

    if (!entry || !target || !stop) return false;

    const isBullish = record.predicted_direction === 'bullish';
    const now = new Date();
    const isExpired = now > new Date(record.expiry_date);

    const hitTarget = isBullish ? current >= target : current <= target;
    const hitStop = isBullish ? current <= stop : current >= stop;
    let pnl = isBullish
      ? ((current - entry) / entry) * 100
      : ((entry - current) / entry) * 100;
    if (isNaN(pnl) || !isFinite(pnl)) pnl = 0;

    // Forex TP checks
    let hitTp1 = false, hitTp2 = false, hitTp3 = false;
    if (record.analysis_type === 'forex' && record.tp1_price) {
      hitTp1 = isBullish ? current >= record.tp1_price : current <= record.tp1_price;
      hitTp2 = record.tp2_price ? (isBullish ? current >= record.tp2_price : current <= record.tp2_price) : false;
      hitTp3 = record.tp3_price ? (isBullish ? current >= record.tp3_price : current <= record.tp3_price) : false;
    }

    let status: BacktestRecord['status'] = 'pending';
    if (hitTarget) status = 'won';
    else if (hitStop) status = 'lost';
    else if (hitTp1 && !hitTarget) status = 'partial';
    else if (isExpired) status = pnl > 0 ? 'won' : 'lost';

    if (status === 'pending') return false;

    const { error } = await supabase
      .from('backtest_records')
      .update({
        status, actual_exit_price: current, actual_exit_date: now.toISOString(),
        pnl_percent: pnl, hit_target: hitTarget, hit_stop: hitStop,
        hit_tp1: hitTp1, hit_tp2: hitTp2, hit_tp3: hitTp3,
        updated_at: now.toISOString(),
      })
      .eq('id', record.id);

    return !error;
  } catch {
    return false;
  }
}

// ============================================================
// STATS & SUMMARY
// ============================================================
export async function getBacktestStats(userId: string, filters?: BacktestFilters): Promise<BacktestStats> {
  const supabase = createAdminClient();
  let query = supabase.from('backtest_records').select('*').eq('user_id', userId);

  if (filters?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.days);
    query = query.gte('created_at', cutoff.toISOString());
  }
  if (filters?.assetType && filters.assetType !== 'all') query = query.eq('analysis_type', filters.assetType);
  if (filters?.symbol) query = query.eq('symbol', filters.symbol.toUpperCase());
  if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);

  const { data: records, error } = await query.order('created_at', { ascending: false });
  if (error || !records) return emptyStats();

  const completed = records.filter(r => r.status !== 'pending');
  const wins = completed.filter(r => r.status === 'won' || r.status === 'partial');
  const losses = completed.filter(r => r.status === 'lost');
  const pending = records.filter(r => r.status === 'pending');

  const avgWin = wins.length > 0 ? wins.reduce((s, r) => s + (r.pnl_percent || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, r) => s + (r.pnl_percent || 0), 0) / losses.length) : 0;
  const totalWin = wins.reduce((s, r) => s + (r.pnl_percent || 0), 0);
  const totalLoss = Math.abs(losses.reduce((s, r) => s + (r.pnl_percent || 0), 0));

  const completedWithDates = completed.filter(r => r.actual_exit_date);
  const avgDuration = completedWithDates.length > 0
    ? completedWithDates.reduce((s, r) => {
        return s + (new Date(r.actual_exit_date!).getTime() - new Date(r.prediction_date).getTime()) / 86400000;
      }, 0) / completedWithDates.length
    : 0;

  const last10 = completed.slice(0, 10);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30 = completed.filter(r => new Date(r.created_at) >= thirtyDaysAgo);
  const sorted = [...completed].sort((a, b) => (b.pnl_percent || 0) - (a.pnl_percent || 0));

  const symStats: Record<string, { w: number; l: number }> = {};
  completed.forEach(r => {
    if (!symStats[r.symbol]) symStats[r.symbol] = { w: 0, l: 0 };
    if (r.status === 'won' || r.status === 'partial') symStats[r.symbol].w++; else symStats[r.symbol].l++;
  });
  const symRates = Object.entries(symStats)
    .map(([s, d]) => ({ s, rate: d.w / (d.w + d.l), total: d.w + d.l }))
    .filter(x => x.total >= 3).sort((a, b) => b.rate - a.rate);

  return {
    total_trades: records.length,
    winning_trades: wins.length,
    losing_trades: losses.length,
    pending_trades: pending.length,
    expired_trades: completed.filter(r => r.status === 'expired').length,
    win_rate: completed.length > 0 ? (wins.length / completed.length) * 100 : 0,
    avg_win_percent: avgWin,
    avg_loss_percent: avgLoss,
    profit_factor: totalLoss > 0 ? totalWin / totalLoss : totalWin,
    bullish_trades: records.filter(r => r.predicted_direction === 'bullish').length,
    bullish_wins: wins.filter(r => r.predicted_direction === 'bullish').length,
    bearish_trades: records.filter(r => r.predicted_direction === 'bearish').length,
    bearish_wins: wins.filter(r => r.predicted_direction === 'bearish').length,
    high_confidence_trades: records.filter(r => r.confidence >= 70).length,
    high_confidence_wins: wins.filter(r => r.confidence >= 70).length,
    low_confidence_trades: records.filter(r => r.confidence < 70).length,
    low_confidence_wins: wins.filter(r => r.confidence < 70).length,
    avg_trade_duration_days: avgDuration,
    last_10_trades_win_rate: last10.length > 0 ? (last10.filter(r => r.status === 'won' || r.status === 'partial').length / last10.length) * 100 : 0,
    last_30_days_win_rate: last30.length > 0 ? (last30.filter(r => r.status === 'won' || r.status === 'partial').length / last30.length) * 100 : 0,
    best_trade_percent: sorted[0]?.pnl_percent || 0,
    worst_trade_percent: sorted[sorted.length - 1]?.pnl_percent || 0,
    best_symbol: symRates[0]?.s || 'N/A',
    worst_symbol: symRates[symRates.length - 1]?.s || 'N/A',
  };
}

export async function getBacktestSummary(userId: string, filters?: BacktestFilters): Promise<BacktestSummary> {
  const supabase = createAdminClient();
  const stats = await getBacktestStats(userId, filters);

  let query = supabase.from('backtest_records').select('*').eq('user_id', userId);
  if (filters?.days) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - filters.days);
    query = query.gte('created_at', cutoff.toISOString());
  }
  if (filters?.assetType && filters.assetType !== 'all') query = query.eq('analysis_type', filters.assetType);
  if (filters?.symbol) query = query.eq('symbol', filters.symbol.toUpperCase());
  if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);

  const { data: records } = await query.order('created_at', { ascending: false }).limit(100);
  const trades = records || [];

  // Group by symbol
  const bySymbol: Record<string, { trades: number; wins: number; losses: number; pending: number; win_rate: number }> = {};
  trades.forEach(r => {
    if (!bySymbol[r.symbol]) bySymbol[r.symbol] = { trades: 0, wins: 0, losses: 0, pending: 0, win_rate: 0 };
    bySymbol[r.symbol].trades++;
    if (r.status === 'won' || r.status === 'partial') bySymbol[r.symbol].wins++;
    else if (r.status === 'lost') bySymbol[r.symbol].losses++;
    else bySymbol[r.symbol].pending++;
  });
  Object.values(bySymbol).forEach(s => {
    const c = s.wins + s.losses;
    s.win_rate = c > 0 ? (s.wins / c) * 100 : 0;
  });

  // Group by strategy
  const byStrategy: Record<string, { trades: number; wins: number; win_rate: number }> = {};
  trades.filter(r => r.options_strategy).forEach(r => {
    const k = r.options_strategy!;
    if (!byStrategy[k]) byStrategy[k] = { trades: 0, wins: 0, win_rate: 0 };
    byStrategy[k].trades++;
    if (r.status === 'won' || r.status === 'partial') byStrategy[k].wins++;
  });
  Object.values(byStrategy).forEach(s => { s.win_rate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0; });

  // Monthly
  const monthly = new Map<string, { trades: number; wins: number; pnl: number }>();
  trades.forEach(r => {
    const m = r.created_at.slice(0, 7);
    if (!monthly.has(m)) monthly.set(m, { trades: 0, wins: 0, pnl: 0 });
    const d = monthly.get(m)!;
    d.trades++;
    if (r.status === 'won' || r.status === 'partial') d.wins++;
    d.pnl += r.pnl_percent || 0;
  });

  return {
    stats,
    recent_trades: trades,
    by_symbol: bySymbol,
    by_strategy: byStrategy,
    monthly_performance: Array.from(monthly.entries())
      .map(([month, d]) => ({ month, trades: d.trades, wins: d.wins, win_rate: d.trades > 0 ? (d.wins / d.trades) * 100 : 0, total_pnl_percent: d.pnl }))
      .sort((a, b) => b.month.localeCompare(a.month)),
  };
}

// ============================================================
// EXPORT & SYMBOLS
// ============================================================
export async function exportBacktestData(userId: string, filters?: BacktestFilters): Promise<string> {
  const supabase = createAdminClient();
  let query = supabase.from('backtest_records').select('*').eq('user_id', userId);
  if (filters?.days) { const c = new Date(); c.setDate(c.getDate() - filters.days); query = query.gte('created_at', c.toISOString()); }
  if (filters?.assetType && filters.assetType !== 'all') query = query.eq('analysis_type', filters.assetType);
  if (filters?.symbol) query = query.eq('symbol', filters.symbol.toUpperCase());
  if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);

  const { data: records } = await query.order('created_at', { ascending: false });
  if (!records?.length) return 'No data to export';

  const headers = ['Date', 'Symbol', 'Type', 'Direction', 'Entry Price', 'Target Price', 'Stop Loss', 'Confidence', 'Status', 'Exit Price', 'P&L %', 'Timeframe', 'Strategy'];
  const rows = records.map(r => [
    new Date(r.prediction_date).toLocaleDateString(), r.symbol, r.analysis_type, r.predicted_direction,
    r.entry_price?.toFixed(r.analysis_type === 'forex' ? 5 : 2) || '', r.target_price?.toFixed(r.analysis_type === 'forex' ? 5 : 2) || '',
    r.stop_loss?.toFixed(r.analysis_type === 'forex' ? 5 : 2) || '', r.confidence?.toString() || '', r.status,
    r.actual_exit_price?.toFixed(r.analysis_type === 'forex' ? 5 : 2) || '', r.pnl_percent?.toFixed(2) || '', r.timeframe || '', r.options_strategy || '',
  ]);
  return [headers.join(','), ...rows.map(row => row.map(c => `"${c}"`).join(','))].join('\n');
}

export async function getBacktestSymbols(userId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from('backtest_records').select('symbol').eq('user_id', userId);
  return data ? [...new Set(data.map(r => r.symbol))].sort() : [];
}

// ============================================================
// HELPERS
// ============================================================
function toNum(val: unknown): number {
  if (typeof val === 'number' && val > 0) return val;
  if (typeof val === 'string') {
    const m = val.match(/\$?([\d.]+)/);
    if (m) return parseFloat(m[1]) || 0;
  }
  return 0;
}

function parsePrice(val: unknown): number {
  return toNum(val);
}

async function fetchLivePrice(symbol: string, type: 'stock' | 'forex'): Promise<number> {
  try {
    if (type === 'forex') {
      const q = await getForexQuote(symbol);
      if (q && 'price' in q) return Number(q.price);
    } else {
      const q = await getStockQuote(symbol);
      if (q?.price) return q.price;
    }
  } catch (e) {
    console.warn(`[Backtest] Live price fetch failed for ${symbol}:`, e);
  }
  return 0;
}

async function getCurrentPrice(symbol: string, type: 'stock' | 'forex'): Promise<PriceCheck | null> {
  const price = await fetchLivePrice(symbol, type);
  if (!price) return null;
  return { symbol, current_price: price, high_since_entry: price, low_since_entry: price, timestamp: new Date().toISOString() };
}

function calculateExpiryDate(timeframe: string): string {
  const now = new Date();
  const match = timeframe.match(/(\d+)\s*(week|day|month)/i);
  if (match) {
    const n = parseInt(match[1]);
    const u = match[2].toLowerCase();
    if (u.includes('week')) now.setDate(now.getDate() + n * 7);
    else if (u.includes('day')) now.setDate(now.getDate() + n);
    else if (u.includes('month')) now.setMonth(now.getMonth() + n);
  } else {
    now.setDate(now.getDate() + 28);
  }
  return now.toISOString();
}

function emptyStats(): BacktestStats {
  return {
    total_trades: 0, winning_trades: 0, losing_trades: 0, pending_trades: 0, expired_trades: 0,
    win_rate: 0, avg_win_percent: 0, avg_loss_percent: 0, profit_factor: 0,
    bullish_trades: 0, bullish_wins: 0, bearish_trades: 0, bearish_wins: 0,
    high_confidence_trades: 0, high_confidence_wins: 0, low_confidence_trades: 0, low_confidence_wins: 0,
    avg_trade_duration_days: 0, last_10_trades_win_rate: 0, last_30_days_win_rate: 0,
    best_trade_percent: 0, worst_trade_percent: 0, best_symbol: 'N/A', worst_symbol: 'N/A',
  };
}
