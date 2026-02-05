import { UnusualFlowSummary } from '@/types/market-data';

const UW_BASE_URL = 'https://api.unusualwhales.com/api';

function getApiKey(): string {
  const key = process.env.UNUSUAL_WHALES_API_KEY;
  if (!key) {
    throw new Error('UNUSUAL_WHALES_API_KEY not configured');
  }
  return key;
}

async function uwFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${UW_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  console.log(`[Unusual Whales API] Calling ${endpoint} with params:`, params);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Unusual Whales API] Error ${response.status}:`, error);
    throw new Error(`Unusual Whales API error: ${response.status} - ${error}`);
  }

  console.log(`[Unusual Whales API] Success for ${endpoint}`);
  return response.json();
}

// ==========================================
// TYPE DEFINITIONS
// ==========================================

interface UWFlowAlert {
  alert_rule: string;
  all_opening_trades: boolean;
  created_at: string;
  expiry: string;
  expiry_count: number;
  has_floor: boolean;
  has_multileg: boolean;
  has_singleleg: boolean;
  has_sweep: boolean;
  issue_type: string;
  open_interest: number;
  option_chain: string;
  price: string;
  strike: string;
  ticker: string;
  total_ask_side_prem: string;
  total_bid_side_prem: string;
  total_premium: string;
  total_size: number;
  trade_count: number;
  type: 'call' | 'put';
  underlying_price: string;
  volume: number;
  volume_oi_ratio: string;
}

interface UWFlowRecent {
  call_premium: string;
  put_premium: string;
  call_volume: number;
  put_volume: number;
  expiry: string;
  date: string;
  ticker: string;
}

interface UWDarkPoolTrade {
  executed_at: string;
  ticker: string;
  price: string;
  size: number;
  premium: string;
  tracking_id: string;
}

interface UWWhaleTrade {
  date: string;
  ticker: string;
  strike: string;
  expiry: string;
  type: 'call' | 'put';
  premium: string;
  size: number;
  is_sweep: boolean;
  is_block: boolean;
  underlying_price: string;
  sentiment: string;
}

// ==========================================
// ENHANCED RESPONSE TYPE
// ==========================================

export interface EnhancedWhaleData {
  symbol: string;

  // Date ranges used
  tradeWindowStart: string;
  tradeWindowEnd: string;
  expirationMin: string;
  expirationMax: string;

  // Summary text for AI
  summary: string;

  // Whale trades ($100K+ premium)
  whaleTrades: {
    count: number;
    callPremium: number;
    putPremium: number;
    sweepCount: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    topTrades: Array<{
      type: string;
      strike: string;
      expiry: string;
      premium: number;
      isSweep: boolean;
      tradeAgeDays: number;
      daysToExpiry: number;
    }>;
  };

  // Flow alerts (filtered: 1-10 days old, 3-13 week exp)
  flowAlerts: {
    count: number;
    totalBeforeFilter: number;
    callPremium: number;
    putPremium: number;
    callAlerts: number;
    putAlerts: number;
    sweepCount: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    topStrikes: string[];
    callPutRatio: number;
  };

  // Trade age distribution
  tradeAgeBuckets: {
    days1_2: number;
    days3_5: number;
    days6_10: number;
  };

  // Expiration distribution
  expirationBuckets: {
    week3_5: number;
    week6_9: number;
    week10_13: number;
  };

  // Dark pool data
  darkPool: {
    tradeCount: number;
    totalVolume: number;
    totalPremium: number;
    sentiment: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  };

  // Overall signals
  signals: {
    overallSentiment: 'STRONGLY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONGLY_BEARISH';
    confidenceScore: number; // 0-100
    keySignals: string[];
    warnings: string[];
  };
}

// ==========================================
// MAIN FUNCTION - COMPREHENSIVE WHALE DATA
// ==========================================

export async function getUnusualOptionsFlow(symbol: string): Promise<UnusualFlowSummary> {
  const upperSymbol = symbol.toUpperCase();

  try {
    const enhancedData = await getEnhancedWhaleData(upperSymbol);

    // Extract numeric strikes from topStrikes (format: "CALL $150" -> 150)
    const numericStrikes = enhancedData.flowAlerts.topStrikes
      .map(s => {
        const match = s.match(/\$?([\d.]+)/);
        return match ? parseFloat(match[1]) : NaN;
      })
      .filter(n => !isNaN(n));

    // Convert to the expected UnusualFlowSummary format for backward compatibility
    return {
      symbol: upperSymbol,
      flows: [], // Detailed flows not needed, we have enhanced data
      total_call_premium: enhancedData.flowAlerts.callPremium + enhancedData.whaleTrades.callPremium,
      total_put_premium: enhancedData.flowAlerts.putPremium + enhancedData.whaleTrades.putPremium,
      call_put_ratio: enhancedData.flowAlerts.callPutRatio || 1,
      overall_sentiment: enhancedData.signals.overallSentiment.includes('BULLISH') ? 'bullish' :
                        enhancedData.signals.overallSentiment.includes('BEARISH') ? 'bearish' : 'neutral',
      notable_strikes: numericStrikes,
      // Add enhanced data for AI consumption
      enhanced_whale_data: enhancedData,
    } as UnusualFlowSummary & { enhanced_whale_data: EnhancedWhaleData };
  } catch (error) {
    console.error(`[Unusual Whales] Error fetching comprehensive data for ${upperSymbol}:`, error);
    throw error;
  }
}

export async function getEnhancedWhaleData(symbol: string): Promise<EnhancedWhaleData> {
  const upperSymbol = symbol.toUpperCase();
  const today = new Date();

  // ==========================================
  // CALCULATE DATE RANGES (matching your n8n logic)
  // ==========================================

  // TRADE AGE FILTER: 1-10 days old
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  // EXPIRATION WINDOW: 3-13 weeks from today
  const minExpiration = new Date();
  minExpiration.setDate(minExpiration.getDate() + (3 * 7)); // 21 days

  const maxExpiration = new Date();
  maxExpiration.setDate(maxExpiration.getDate() + (13 * 7)); // 91 days

  const tenDaysAgoStr = tenDaysAgo.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const minExpirationStr = minExpiration.toISOString().split('T')[0];
  const maxExpirationStr = maxExpiration.toISOString().split('T')[0];

  console.log(`[Unusual Whales] Fetching comprehensive data for ${upperSymbol}`);
  console.log(`[Unusual Whales] Trade Window: ${tenDaysAgoStr} to ${todayStr}`);
  console.log(`[Unusual Whales] Expiration Window: ${minExpirationStr} to ${maxExpirationStr}`);

  // ==========================================
  // FETCH ALL DATA IN PARALLEL
  // ==========================================

  const [alertsResult, flowResult, darkPoolResult, whaleResult] = await Promise.allSettled([
    // Flow Alerts
    uwFetch<{ data: UWFlowAlert[] }>(`/stock/${upperSymbol}/flow-alerts`, {
      limit: '200',
    }),

    // Flow Recent
    uwFetch<{ data: UWFlowRecent[] }>(`/stock/${upperSymbol}/flow-recent`, {
      min_premium: '5000',
    }),

    // Dark Pool (last 10 days)
    uwFetch<{ data: UWDarkPoolTrade[] }>(`/darkpool/${upperSymbol}`, {
      date_from: tenDaysAgoStr,
      date_to: todayStr,
      limit: '500',
    }),

    // Whale Trades ($100K+ premium)
    uwFetch<{ data: UWWhaleTrade[] }>('/option-trade/full-tape', {
      ticker: upperSymbol,
      limit: '200',
      min_premium: '100000',
    }),
  ]);

  // Extract data safely
  const alertsData = alertsResult.status === 'fulfilled' ? alertsResult.value.data || [] : [];
  const flowData = flowResult.status === 'fulfilled' ? flowResult.value.data || [] : [];
  const darkPoolData = darkPoolResult.status === 'fulfilled' ? darkPoolResult.value.data || [] : [];
  const whaleData = whaleResult.status === 'fulfilled' ? whaleResult.value.data || [] : [];

  console.log(`[Unusual Whales] Fetched - Alerts: ${alertsData.length}, Flow: ${flowData.length}, Dark Pool: ${darkPoolData.length}, Whales: ${whaleData.length}`);

  // ==========================================
  // FILTER ALERTS: 1-10 days old + 3-13 week expirations
  // ==========================================

  const filteredAlerts = alertsData.filter(alert => {
    if (!alert.expiry || !alert.created_at) return false;

    const tradeDate = new Date(alert.created_at);
    const expiryDate = new Date(alert.expiry);

    const tradeAge = (today.getTime() - tradeDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysToExpiry = (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    // Trade must be 1-10 days old AND expiration 3-13 weeks (21-91 days)
    return (tradeAge >= 0 && tradeAge <= 10) && (daysToExpiry >= 21 && daysToExpiry <= 91);
  });

  // ==========================================
  // FILTER WHALE TRADES: same criteria
  // ==========================================

  const filteredWhales = whaleData.filter(trade => {
    if (!trade.expiry || !trade.date) return false;

    const tradeDate = new Date(trade.date);
    const expiryDate = new Date(trade.expiry);

    const tradeAge = (today.getTime() - tradeDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysToExpiry = (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    return (tradeAge >= 0 && tradeAge <= 10) && (daysToExpiry >= 21 && daysToExpiry <= 91);
  });

  console.log(`[Unusual Whales] After filtering - Alerts: ${filteredAlerts.length}/${alertsData.length}, Whales: ${filteredWhales.length}/${whaleData.length}`);

  // ==========================================
  // CALCULATE METRICS
  // ==========================================

  // Flow Alerts Metrics
  const alertCallPremium = filteredAlerts
    .filter(a => a.type === 'call')
    .reduce((sum, a) => sum + parseFloat(a.total_premium || '0'), 0);

  const alertPutPremium = filteredAlerts
    .filter(a => a.type === 'put')
    .reduce((sum, a) => sum + parseFloat(a.total_premium || '0'), 0);

  const alertCallCount = filteredAlerts.filter(a => a.type === 'call').length;
  const alertPutCount = filteredAlerts.filter(a => a.type === 'put').length;
  const alertSweepCount = filteredAlerts.filter(a => a.has_sweep).length;

  // Whale Metrics
  const whaleCallPremium = filteredWhales
    .filter(t => t.type === 'call')
    .reduce((sum, t) => sum + parseFloat(t.premium || '0'), 0);

  const whalePutPremium = filteredWhales
    .filter(t => t.type === 'put')
    .reduce((sum, t) => sum + parseFloat(t.premium || '0'), 0);

  const whaleSweepCount = filteredWhales.filter(t => t.is_sweep).length;

  // Top strikes
  const strikeActivity: Record<string, number> = {};
  filteredAlerts.forEach(alert => {
    const key = `${alert.type.toUpperCase()} $${alert.strike}`;
    strikeActivity[key] = (strikeActivity[key] || 0) + 1;
  });

  const topStrikes = Object.entries(strikeActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([strike]) => strike);

  // Trade age buckets
  const tradeAgeBuckets = { days1_2: 0, days3_5: 0, days6_10: 0 };
  filteredAlerts.forEach(alert => {
    const tradeAge = (today.getTime() - new Date(alert.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (tradeAge <= 2) tradeAgeBuckets.days1_2++;
    else if (tradeAge <= 5) tradeAgeBuckets.days3_5++;
    else tradeAgeBuckets.days6_10++;
  });

  // Expiration buckets
  const expirationBuckets = { week3_5: 0, week6_9: 0, week10_13: 0 };
  filteredAlerts.forEach(alert => {
    const daysToExpiry = (new Date(alert.expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (daysToExpiry <= 35) expirationBuckets.week3_5++;
    else if (daysToExpiry <= 63) expirationBuckets.week6_9++;
    else expirationBuckets.week10_13++;
  });

  // Dark pool metrics
  const darkPoolVolume = darkPoolData.reduce((sum, t) => sum + (t.size || 0), 0);
  const darkPoolPremium = darkPoolData.reduce((sum, t) => sum + parseFloat(t.premium || '0'), 0);

  // ==========================================
  // DETERMINE SENTIMENTS
  // ==========================================

  const whaleSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
    whaleCallPremium > whalePutPremium * 1.5 ? 'BULLISH' :
    whalePutPremium > whaleCallPremium * 1.5 ? 'BEARISH' : 'NEUTRAL';

  const alertSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
    alertCallPremium > alertPutPremium * 1.5 ? 'BULLISH' :
    alertPutPremium > alertCallPremium * 1.5 ? 'BEARISH' : 'NEUTRAL';

  const darkPoolSentiment: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' =
    darkPoolVolume > 1000000 ? 'ACCUMULATION' : 'NEUTRAL';

  // Overall sentiment (whale-weighted)
  const totalCallPrem = whaleCallPremium + alertCallPremium;
  const totalPutPrem = whalePutPremium + alertPutPremium;
  const callPutRatio = totalPutPrem > 0 ? totalCallPrem / totalPutPrem : 1;

  let overallSentiment: 'STRONGLY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONGLY_BEARISH';
  if (callPutRatio > 3 && whaleSentiment === 'BULLISH') {
    overallSentiment = 'STRONGLY_BULLISH';
  } else if (callPutRatio > 1.5 || whaleSentiment === 'BULLISH') {
    overallSentiment = 'BULLISH';
  } else if (callPutRatio < 0.33 && whaleSentiment === 'BEARISH') {
    overallSentiment = 'STRONGLY_BEARISH';
  } else if (callPutRatio < 0.67 || whaleSentiment === 'BEARISH') {
    overallSentiment = 'BEARISH';
  } else {
    overallSentiment = 'NEUTRAL';
  }

  // ==========================================
  // KEY SIGNALS & WARNINGS
  // ==========================================

  const keySignals: string[] = [];
  const warnings: string[] = [];

  // Whale signals
  if (filteredWhales.length > 20) {
    keySignals.push(`🚨 EXTREME WHALE ACTIVITY: ${filteredWhales.length} large trades ($100K+) in last 10 days`);
  } else if (filteredWhales.length > 10) {
    keySignals.push(`🐋 HIGH WHALE ACTIVITY: ${filteredWhales.length} large trades in last 10 days`);
  }

  // Premium signals
  if (totalCallPrem > totalPutPrem * 2) {
    keySignals.push(`🟢 STRONGLY BULLISH FLOW: ${callPutRatio.toFixed(1)}:1 call/put premium ratio`);
  } else if (totalCallPrem > totalPutPrem * 1.5) {
    keySignals.push(`🟢 BULLISH FLOW: ${callPutRatio.toFixed(1)}:1 call/put premium ratio`);
  }

  if (totalPutPrem > totalCallPrem * 2) {
    keySignals.push(`🔴 STRONGLY BEARISH FLOW: ${(1/callPutRatio).toFixed(1)}:1 put/call premium ratio`);
  } else if (totalPutPrem > totalCallPrem * 1.5) {
    keySignals.push(`🔴 BEARISH FLOW: ${(1/callPutRatio).toFixed(1)}:1 put/call premium ratio`);
  }

  // Sweep signals (urgency)
  const totalSweeps = alertSweepCount + whaleSweepCount;
  if (totalSweeps > 10) {
    keySignals.push(`🔥 EXTREME URGENCY: ${totalSweeps} sweep orders detected`);
  } else if (totalSweeps > 5) {
    keySignals.push(`🔥 HIGH URGENCY: ${totalSweeps} sweep orders detected`);
  }

  // Recency signals
  if (tradeAgeBuckets.days1_2 > filteredAlerts.length * 0.4 && filteredAlerts.length > 0) {
    keySignals.push(`⚡ VERY RECENT: ${Math.round(tradeAgeBuckets.days1_2 / filteredAlerts.length * 100)}% of trades in last 2 days`);
  }

  // Expiration concentration
  if (expirationBuckets.week3_5 > filteredAlerts.length * 0.5 && filteredAlerts.length > 0) {
    keySignals.push(`🎯 NEAR-TERM CATALYST: ${Math.round(expirationBuckets.week3_5 / filteredAlerts.length * 100)}% expire in 3-5 weeks`);
  }

  // Dark pool signals
  if (darkPoolVolume > 5000000) {
    keySignals.push(`🐋 MASSIVE INSTITUTIONAL: ${(darkPoolVolume / 1000000).toFixed(1)}M shares in dark pools`);
  } else if (darkPoolVolume > 1000000) {
    keySignals.push(`🏦 HEAVY INSTITUTIONAL: ${(darkPoolVolume / 1000000).toFixed(1)}M shares in dark pools`);
  }

  // Strike concentration
  if (topStrikes.length > 0) {
    keySignals.push(`🎯 HOT STRIKES: ${topStrikes.slice(0, 3).join(', ')}`);
  }

  // Warnings
  if (filteredAlerts.length < 5 && filteredWhales.length < 3) {
    warnings.push('⚠️ LOW DATA: Limited unusual activity detected - use caution');
  }

  if (whaleSentiment !== alertSentiment && whaleSentiment !== 'NEUTRAL' && alertSentiment !== 'NEUTRAL') {
    warnings.push(`⚠️ CONFLICTING SIGNALS: Whale sentiment (${whaleSentiment}) differs from flow sentiment (${alertSentiment})`);
  }

  // Calculate confidence score
  let confidenceScore = 50; // Base
  if (filteredWhales.length > 10) confidenceScore += 15;
  else if (filteredWhales.length > 5) confidenceScore += 10;
  if (totalSweeps > 5) confidenceScore += 10;
  if (Math.abs(callPutRatio - 1) > 1) confidenceScore += 10;
  if (tradeAgeBuckets.days1_2 > filteredAlerts.length * 0.3) confidenceScore += 5;
  if (darkPoolVolume > 1000000) confidenceScore += 10;
  if (warnings.length > 0) confidenceScore -= 10;
  confidenceScore = Math.max(20, Math.min(95, confidenceScore));

  // ==========================================
  // BUILD SUMMARY FOR AI
  // ==========================================

  const summary = buildAISummary({
    symbol: upperSymbol,
    tenDaysAgoStr,
    todayStr,
    minExpirationStr,
    maxExpirationStr,
    filteredAlerts,
    alertsData,
    filteredWhales,
    whaleCallPremium,
    whalePutPremium,
    whaleSweepCount,
    alertCallPremium,
    alertPutPremium,
    alertCallCount,
    alertPutCount,
    alertSweepCount,
    topStrikes,
    tradeAgeBuckets,
    expirationBuckets,
    darkPoolData,
    darkPoolVolume,
    darkPoolPremium,
    callPutRatio,
    overallSentiment,
    keySignals,
    warnings,
    confidenceScore,
    today,
  });

  // ==========================================
  // BUILD TOP WHALE TRADES
  // ==========================================

  const topWhaleTrades = filteredWhales
    .sort((a, b) => parseFloat(b.premium || '0') - parseFloat(a.premium || '0'))
    .slice(0, 10)
    .map(t => ({
      type: t.type.toUpperCase(),
      strike: t.strike,
      expiry: t.expiry,
      premium: parseFloat(t.premium || '0'),
      isSweep: t.is_sweep || false,
      tradeAgeDays: Math.floor((today.getTime() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24)),
      daysToExpiry: Math.floor((new Date(t.expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    }));

  return {
    symbol: upperSymbol,
    tradeWindowStart: tenDaysAgoStr,
    tradeWindowEnd: todayStr,
    expirationMin: minExpirationStr,
    expirationMax: maxExpirationStr,
    summary,
    whaleTrades: {
      count: filteredWhales.length,
      callPremium: whaleCallPremium,
      putPremium: whalePutPremium,
      sweepCount: whaleSweepCount,
      sentiment: whaleSentiment,
      topTrades: topWhaleTrades,
    },
    flowAlerts: {
      count: filteredAlerts.length,
      totalBeforeFilter: alertsData.length,
      callPremium: alertCallPremium,
      putPremium: alertPutPremium,
      callAlerts: alertCallCount,
      putAlerts: alertPutCount,
      sweepCount: alertSweepCount,
      sentiment: alertSentiment,
      topStrikes,
      callPutRatio,
    },
    tradeAgeBuckets,
    expirationBuckets,
    darkPool: {
      tradeCount: darkPoolData.length,
      totalVolume: darkPoolVolume,
      totalPremium: darkPoolPremium,
      sentiment: darkPoolSentiment,
    },
    signals: {
      overallSentiment,
      confidenceScore,
      keySignals,
      warnings,
    },
  };
}

// ==========================================
// BUILD AI SUMMARY
// ==========================================

function buildAISummary(data: {
  symbol: string;
  tenDaysAgoStr: string;
  todayStr: string;
  minExpirationStr: string;
  maxExpirationStr: string;
  filteredAlerts: UWFlowAlert[];
  alertsData: UWFlowAlert[];
  filteredWhales: UWWhaleTrade[];
  whaleCallPremium: number;
  whalePutPremium: number;
  whaleSweepCount: number;
  alertCallPremium: number;
  alertPutPremium: number;
  alertCallCount: number;
  alertPutCount: number;
  alertSweepCount: number;
  topStrikes: string[];
  tradeAgeBuckets: { days1_2: number; days3_5: number; days6_10: number };
  expirationBuckets: { week3_5: number; week6_9: number; week10_13: number };
  darkPoolData: UWDarkPoolTrade[];
  darkPoolVolume: number;
  darkPoolPremium: number;
  callPutRatio: number;
  overallSentiment: string;
  keySignals: string[];
  warnings: string[];
  confidenceScore: number;
  today: Date;
}): string {
  const {
    symbol, tenDaysAgoStr, todayStr, minExpirationStr, maxExpirationStr,
    filteredAlerts, alertsData, filteredWhales, whaleCallPremium, whalePutPremium,
    whaleSweepCount, alertCallPremium, alertPutPremium, alertCallCount, alertPutCount,
    alertSweepCount, topStrikes, tradeAgeBuckets, expirationBuckets,
    darkPoolData, darkPoolVolume, darkPoolPremium, callPutRatio,
    overallSentiment, keySignals, warnings, confidenceScore, today
  } = data;

  let summary = `═══════════════════════════════════════════════════════════════════
🐋 UNUSUAL WHALES SMART MONEY ANALYSIS: ${symbol}
═══════════════════════════════════════════════════════════════════

📅 ANALYSIS PARAMETERS:
• Trade Window: Last 10 days (${tenDaysAgoStr} to ${todayStr})
• Expiration Window: 3-13 weeks (${minExpirationStr} to ${maxExpirationStr})
• Alerts Analyzed: ${filteredAlerts.length} (filtered from ${alertsData.length} total)

`;

  // WHALE SECTION
  if (filteredWhales.length > 0) {
    summary += `🚨 WHALE TRADES ($100K+ PREMIUM):
• Total Whale Trades: ${filteredWhales.length}
• Whale Call Premium: $${(whaleCallPremium / 1000000).toFixed(2)}M
• Whale Put Premium: $${(whalePutPremium / 1000000).toFixed(2)}M
• Whale Sweep Orders: ${whaleSweepCount}
• WHALE SENTIMENT: ${whaleCallPremium > whalePutPremium * 1.5 ? '🟢 BULLISH' : whalePutPremium > whaleCallPremium * 1.5 ? '🔴 BEARISH' : '⚪ NEUTRAL'}

TOP 5 WHALE TRADES:
`;

    const topWhales = filteredWhales
      .sort((a, b) => parseFloat(b.premium || '0') - parseFloat(a.premium || '0'))
      .slice(0, 5);

    topWhales.forEach((t, i) => {
      const premMil = parseFloat(t.premium || '0') / 1000000;
      const tradeAge = Math.floor((today.getTime() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24));
      const daysToExp = Math.floor((new Date(t.expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      summary += `  ${i + 1}. $${premMil.toFixed(2)}M ${t.type.toUpperCase()} $${t.strike} | ${tradeAge}d ago → exp in ${daysToExp}d${t.is_sweep ? ' [SWEEP]' : ''}\n`;
    });

    summary += '\n';
  }

  // FLOW SECTION
  summary += `📊 OPTIONS FLOW (Filtered: 1-10 days old, 3-13 week exp):
• Call Premium: $${(alertCallPremium / 1000000).toFixed(2)}M (${alertCallCount} alerts)
• Put Premium: $${(alertPutPremium / 1000000).toFixed(2)}M (${alertPutCount} alerts)
• Net Flow: ${alertCallPremium > alertPutPremium ? '🟢 BULLISH' : '🔴 BEARISH'} ($${(Math.abs(alertCallPremium - alertPutPremium) / 1000000).toFixed(2)}M)
• Call/Put Ratio: ${callPutRatio.toFixed(2)}:1
• Sweep Orders: ${alertSweepCount}

`;

  // TRADE AGE DISTRIBUTION
  summary += `⏱️ TRADE AGE DISTRIBUTION:
• Last 2 days: ${tradeAgeBuckets.days1_2} alerts ${tradeAgeBuckets.days1_2 > filteredAlerts.length * 0.4 ? '⚡ VERY RECENT!' : ''}
• 3-5 days ago: ${tradeAgeBuckets.days3_5} alerts
• 6-10 days ago: ${tradeAgeBuckets.days6_10} alerts

`;

  // EXPIRATION DISTRIBUTION
  summary += `📆 EXPIRATION DISTRIBUTION:
• Weeks 3-5 (21-35 days): ${expirationBuckets.week3_5} alerts ${expirationBuckets.week3_5 > filteredAlerts.length * 0.5 ? '🎯 NEAR-TERM CATALYST!' : ''}
• Weeks 6-9 (36-63 days): ${expirationBuckets.week6_9} alerts
• Weeks 10-13 (64-91 days): ${expirationBuckets.week10_13} alerts

`;

  // DARK POOL
  summary += `🏦 DARK POOL ACTIVITY (Last 10 days):
• Total Trades: ${darkPoolData.length}
• Volume: ${(darkPoolVolume / 1000000).toFixed(2)}M shares
• Premium: $${(darkPoolPremium / 1000000).toFixed(2)}M
${darkPoolVolume > 1000000 ? '• 🐋 SIGNIFICANT INSTITUTIONAL ACTIVITY DETECTED' : ''}

`;

  // TOP STRIKES
  if (topStrikes.length > 0) {
    summary += `🎯 HOTTEST STRIKES:\n`;
    topStrikes.forEach((strike, i) => {
      summary += `  ${i + 1}. ${strike}\n`;
    });
    summary += '\n';
  }

  // KEY SIGNALS
  summary += `═══════════════════════════════════════════════════════════════════
🚦 SMART MONEY SIGNALS:
═══════════════════════════════════════════════════════════════════
`;

  if (keySignals.length > 0) {
    keySignals.forEach(signal => {
      summary += `${signal}\n`;
    });
  } else {
    summary += `• No strong signals detected\n`;
  }

  // WARNINGS
  if (warnings.length > 0) {
    summary += `\n⚠️ WARNINGS:\n`;
    warnings.forEach(warning => {
      summary += `${warning}\n`;
    });
  }

  // OVERALL VERDICT
  summary += `
═══════════════════════════════════════════════════════════════════
📊 OVERALL SMART MONEY VERDICT: ${overallSentiment.replace('_', ' ')}
🎯 CONFIDENCE SCORE: ${confidenceScore}/100
═══════════════════════════════════════════════════════════════════

CRITICAL: Your trading decision MUST align with the whale activity above.
If whales are BULLISH, do NOT recommend BEARISH trades (and vice versa).
The smart money (whales) have more information than retail traders.
`;

  return summary;
}
