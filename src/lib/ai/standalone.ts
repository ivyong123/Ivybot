// Standalone analysis functions - single tool, AI summary, fast execution
// No trading predictions, just data + summary

import { chatCompletion } from './openrouter-client';
import {
  getHistoricalData,
  getAnalystRatings,
  getEarningsCalendar,
  getNewsSentiment,
  getUnusualOptionsFlow,
  getInsiderTrades,
  getInstitutionalHoldings,
  getFinnhubEarnings,
  getFinnhubRecommendations,
  getForexHistoricalData,
  getForexIndicator,
  getForexQuote,
} from '@/lib/providers';
import { StandaloneType } from '@/types/analysis';
import { ChatMessage } from '@/types/ai';

export interface StandaloneResult {
  symbol: string;
  type: StandaloneType;
  data: Record<string, unknown>;
  summary: string;
  error?: string;
  generated_at: string;
}

// Helper to detect if symbol is a forex pair
function isForexPair(symbol: string): boolean {
  // Check if it contains "/" (e.g., "EUR/USD")
  if (symbol.includes('/')) return true;

  // Check if it's a 6-letter currency pair (e.g., "EURUSD", "GBPUSD")
  const forexPairs = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];
  const upper = symbol.toUpperCase();
  if (upper.length === 6) {
    const base = upper.slice(0, 3);
    const quote = upper.slice(3);
    return forexPairs.includes(base) && forexPairs.includes(quote);
  }

  return false;
}

// Format forex pair for TwelveData (e.g., "EURUSD" -> "EUR/USD")
function formatForexPair(symbol: string): string {
  if (symbol.includes('/')) return symbol.toUpperCase();
  return `${symbol.slice(0, 3).toUpperCase()}/${symbol.slice(3).toUpperCase()}`;
}

// Technical Analysis - OHLCV + AI summary (supports both stocks and forex)
async function runTechnicalAnalysis(symbol: string): Promise<StandaloneResult> {
  const upperSymbol = symbol.toUpperCase();
  const isForex = isForexPair(upperSymbol);

  try {
    let candles;
    let currentPrice: number;

    if (isForex) {
      // Use TwelveData for forex
      const forexPair = formatForexPair(upperSymbol);
      candles = await getForexHistoricalData(forexPair, '1day', 50);

      // Get current price from quote
      try {
        const quote = await getForexQuote(forexPair);
        currentPrice = quote.mid;
      } catch {
        // Fallback to last candle close
        currentPrice = candles[candles.length - 1]?.close || 0;
      }
    } else {
      // Use Polygon for stocks
      candles = await getHistoricalData(upperSymbol, '1m', '1day');
      currentPrice = candles[candles.length - 1]?.close || 0;
    }

    if (!candles || candles.length === 0) {
      throw new Error('No historical data available');
    }

    // Calculate basic technical indicators
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // RSI (14-period)
    const rsi = calculateRSI(closes, 14);

    // Simple Moving Averages
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, Math.min(50, closes.length));

    // Support and Resistance
    const recentHighs = highs.slice(-20);
    const recentLows = lows.slice(-20);
    const resistance = Math.max(...recentHighs);
    const support = Math.min(...recentLows);

    // MACD
    const macd = calculateMACD(closes);

    // Format prices appropriately for forex vs stocks
    const priceDecimals = isForex ? (upperSymbol.includes('JPY') ? 3 : 5) : 2;
    const formatPrice = (p: number) => Number(p.toFixed(priceDecimals));

    const technicalData = {
      symbol: isForex ? formatForexPair(upperSymbol) : upperSymbol,
      asset_type: isForex ? 'forex' : 'stock',
      current_price: formatPrice(currentPrice),
      rsi_14: Math.round(rsi * 100) / 100,
      sma_20: formatPrice(sma20),
      sma_50: formatPrice(sma50),
      macd: macd,
      support_level: formatPrice(support),
      resistance_level: formatPrice(resistance),
      price_vs_sma20: currentPrice > sma20 ? 'above' : 'below',
      price_vs_sma50: currentPrice > sma50 ? 'above' : 'below',
      trend: currentPrice > sma20 && sma20 > sma50 ? 'uptrend' : currentPrice < sma20 && sma20 < sma50 ? 'downtrend' : 'sideways',
      candle_count: closes.length,
    };

    // Get AI summary
    const displaySymbol = isForex ? formatForexPair(upperSymbol) : upperSymbol;
    const summary = await getAISummary('technical', displaySymbol, technicalData);

    return {
      symbol: displaySymbol,
      type: 'technical',
      data: technicalData,
      summary,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const displaySymbol = isForex ? formatForexPair(upperSymbol) : upperSymbol;
    return {
      symbol: displaySymbol,
      type: 'technical',
      data: {},
      summary: `Failed to fetch technical data: ${errorMsg}`,
      error: errorMsg,
      generated_at: new Date().toISOString(),
    };
  }
}

// Fundamentals Analysis - Analyst ratings (with Finnhub fallback)
async function runFundamentalsAnalysis(symbol: string): Promise<StandaloneResult> {
  const upperSymbol = symbol.toUpperCase();
  let dataSource = 'benzinga';

  try {
    // Try Benzinga first
    const ratings = await getAnalystRatings(upperSymbol, 15);

    const fundamentalData = {
      symbol: upperSymbol,
      analyst_count: ratings.ratings.length,
      consensus: ratings.consensus,
      average_target: ratings.avg_price_target,
      high_target: ratings.high_price_target,
      low_target: ratings.low_price_target,
      recent_ratings: ratings.ratings.slice(0, 5).map(r => ({
        analyst: r.analyst,
        rating: r.rating,
        target: r.price_target,
        date: r.date,
      })),
      source: 'Benzinga',
    };

    const summary = await getAISummary('fundamentals', upperSymbol, fundamentalData);

    return {
      symbol: upperSymbol,
      type: 'fundamentals',
      data: fundamentalData,
      summary,
      generated_at: new Date().toISOString(),
    };
  } catch (benzingaError) {
    // Fallback to Finnhub
    try {
      dataSource = 'finnhub';
      const finnhubData = await getFinnhubRecommendations(upperSymbol);

      const fundamentalData = {
        symbol: upperSymbol,
        analyst_count: finnhubData.buy + finnhubData.hold + finnhubData.sell + finnhubData.strongBuy + finnhubData.strongSell,
        consensus: finnhubData.consensus,
        average_target: finnhubData.targetMean,
        high_target: finnhubData.targetHigh,
        low_target: finnhubData.targetLow,
        buy_count: finnhubData.buy + finnhubData.strongBuy,
        hold_count: finnhubData.hold,
        sell_count: finnhubData.sell + finnhubData.strongSell,
        source: 'Finnhub',
      };

      const summary = await getAISummary('fundamentals', upperSymbol, fundamentalData);

      return {
        symbol: upperSymbol,
        type: 'fundamentals',
        data: fundamentalData,
        summary,
        generated_at: new Date().toISOString(),
      };
    } catch (finnhubError) {
      const errorMsg = benzingaError instanceof Error ? benzingaError.message : 'Unknown error';
      return {
        symbol: upperSymbol,
        type: 'fundamentals',
        data: {},
        summary: `Failed to fetch fundamentals data: ${errorMsg}`,
        error: errorMsg,
        generated_at: new Date().toISOString(),
      };
    }
  }
}

// Earnings Analysis - Earnings calendar (with Finnhub fallback)
async function runEarningsAnalysis(symbol: string): Promise<StandaloneResult> {
  const upperSymbol = symbol.toUpperCase();

  try {
    // Try Benzinga first
    const earnings = await getEarningsCalendar(upperSymbol);

    const today = new Date();
    const upcomingEarnings = earnings.upcoming.filter(e => new Date(e.report_date) >= today);
    const nextEarnings = upcomingEarnings[0];

    const earningsData = {
      symbol: upperSymbol,
      next_earnings_date: nextEarnings?.report_date || null,
      days_until_earnings: nextEarnings ? Math.ceil((new Date(nextEarnings.report_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null,
      eps_estimate: nextEarnings?.eps_estimate || null,
      revenue_estimate: nextEarnings?.revenue_estimate || null,
      recent_history: earnings.recent.slice(0, 4).map(h => ({
        date: h.report_date,
        eps_actual: h.eps_actual,
        eps_estimate: h.eps_estimate,
        surprise: h.eps_surprise,
      })),
      source: 'Benzinga',
    };

    const summary = await getAISummary('earnings', upperSymbol, earningsData);

    return {
      symbol: upperSymbol,
      type: 'earnings',
      data: earningsData,
      summary,
      generated_at: new Date().toISOString(),
    };
  } catch (benzingaError) {
    // Fallback to Finnhub
    try {
      const finnhubEarnings = await getFinnhubEarnings(upperSymbol);
      const today = new Date();
      const nextEarnings = finnhubEarnings.upcoming[0];

      const earningsData = {
        symbol: upperSymbol,
        next_earnings_date: nextEarnings?.date || null,
        days_until_earnings: nextEarnings ? Math.ceil((new Date(nextEarnings.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null,
        eps_estimate: nextEarnings?.epsEstimate || null,
        revenue_estimate: nextEarnings?.revenueEstimate || null,
        recent_history: finnhubEarnings.recent.slice(0, 4).map(h => ({
          date: h.date,
          eps_actual: h.epsActual,
          eps_estimate: h.epsEstimate,
          surprise: h.epsSurprise,
        })),
        source: 'Finnhub',
      };

      const summary = await getAISummary('earnings', upperSymbol, earningsData);

      return {
        symbol: upperSymbol,
        type: 'earnings',
        data: earningsData,
        summary,
        generated_at: new Date().toISOString(),
      };
    } catch (finnhubError) {
      const errorMsg = benzingaError instanceof Error ? benzingaError.message : 'Unknown error';
      return {
        symbol: upperSymbol,
        type: 'earnings',
        data: {},
        summary: `Failed to fetch earnings data: ${errorMsg}`,
        error: errorMsg,
        generated_at: new Date().toISOString(),
      };
    }
  }
}

// News & Sentiment Analysis
async function runNewsAnalysis(symbol: string): Promise<StandaloneResult> {
  const upperSymbol = symbol.toUpperCase();

  try {
    const news = await getNewsSentiment(upperSymbol, 7);

    const newsData = {
      symbol: upperSymbol,
      article_count: news.articles.length,
      overall_sentiment: news.overall_sentiment,
      sentiment_score: news.sentiment_score,
      bullish_count: news.articles.filter(a => a.sentiment === 'positive').length,
      bearish_count: news.articles.filter(a => a.sentiment === 'negative').length,
      neutral_count: news.articles.filter(a => a.sentiment === 'neutral').length,
      top_headlines: news.articles.slice(0, 5).map(a => ({
        title: a.title,
        source: a.source,
        sentiment: a.sentiment,
        date: a.published_at,
        url: a.url,
      })),
    };

    const summary = await getAISummary('news', upperSymbol, newsData);

    return {
      symbol: upperSymbol,
      type: 'news',
      data: newsData,
      summary,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      symbol: upperSymbol,
      type: 'news',
      data: {},
      summary: `Failed to fetch news data: ${errorMsg}`,
      error: errorMsg,
      generated_at: new Date().toISOString(),
    };
  }
}

// Smart Money Analysis - Options flow + SEC Edgar fallback
async function runSmartMoneyAnalysis(symbol: string): Promise<StandaloneResult> {
  const upperSymbol = symbol.toUpperCase();

  let optionsFlowData = null;
  let optionsFlowError = null;
  let insiderData = null;
  let institutionalData = null;

  // Try Unusual Whales first
  try {
    optionsFlowData = await getUnusualOptionsFlow(upperSymbol);
  } catch (error) {
    optionsFlowError = error instanceof Error ? error.message : 'Unusual Whales unavailable';
  }

  // Always get SEC EDGAR data as supplement (or fallback)
  try {
    insiderData = await getInsiderTrades(upperSymbol);
  } catch (error) {
    console.error('Failed to get insider trades:', error);
  }

  try {
    institutionalData = await getInstitutionalHoldings(upperSymbol);
  } catch (error) {
    console.error('Failed to get institutional holdings:', error);
  }

  const smartMoneyData: Record<string, unknown> = {
    symbol: upperSymbol,
    unusual_whales_available: optionsFlowData !== null,
    unusual_whales_error: optionsFlowError,
  };

  if (optionsFlowData) {
    smartMoneyData.options_flow = {
      total_call_premium: optionsFlowData.total_call_premium,
      total_put_premium: optionsFlowData.total_put_premium,
      call_put_ratio: optionsFlowData.call_put_ratio,
      overall_sentiment: optionsFlowData.overall_sentiment,
      notable_strikes: optionsFlowData.notable_strikes,
      flow_count: optionsFlowData.flows.length,
    };
  }

  if (insiderData) {
    smartMoneyData.insider_trading = {
      total_buys: insiderData.summary.total_buys,
      total_sells: insiderData.summary.total_sells,
      sentiment: insiderData.summary.sentiment,
      recent_trades: insiderData.trades.slice(0, 5),
    };
  }

  if (institutionalData) {
    smartMoneyData.institutional = {
      total_institutions: institutionalData.summary.total_institutions,
      sentiment: institutionalData.summary.sentiment,
    };
  }

  const summary = await getAISummary('smart_money', upperSymbol, smartMoneyData);

  return {
    symbol: upperSymbol,
    type: 'smart_money',
    data: smartMoneyData,
    summary,
    error: optionsFlowError || undefined,
    generated_at: new Date().toISOString(),
  };
}

// Get AI Summary for standalone data
async function getAISummary(type: StandaloneType, symbol: string, data: Record<string, unknown>): Promise<string> {
  const prompts: Record<StandaloneType, string> = {
    technical: `You are a technical analyst. Summarize the following technical data for ${symbol} in 2-3 paragraphs. Focus on:
- Current trend direction and strength
- Key support and resistance levels
- RSI and MACD signals
- Overall technical outlook (bullish/bearish/neutral)
Do NOT provide trading recommendations or price predictions. Just summarize the technical picture.`,

    fundamentals: `You are a fundamental analyst. Summarize the following analyst ratings data for ${symbol} in 2-3 paragraphs. Focus on:
- Analyst consensus and what it means
- Price target range and average
- Recent rating changes (upgrades/downgrades)
- Overall fundamental outlook
Do NOT provide trading recommendations. Just summarize analyst sentiment.`,

    earnings: `You are an earnings analyst. Summarize the following earnings data for ${symbol} in 2-3 paragraphs. Focus on:
- When the next earnings report is expected
- Historical earnings surprises (beats/misses)
- What to watch for
Do NOT provide trading recommendations. Just summarize the earnings situation.`,

    news: `You are a news analyst. Summarize the following news sentiment data for ${symbol} in 2-3 paragraphs. Focus on:
- Overall sentiment from recent news
- Key headlines and their implications
- Any notable positive or negative catalysts
Do NOT provide trading recommendations. Just summarize the news sentiment.`,

    smart_money: `You are a smart money analyst. Summarize the following institutional and options flow data for ${symbol} in 2-3 paragraphs. Focus on:
- Options flow sentiment (if available) - call/put ratio, notable activity
- Insider trading activity - are executives buying or selling?
- Institutional positioning trends
- What smart money appears to be doing
Do NOT provide trading recommendations. Just summarize smart money activity.`,
  };

  const messages: ChatMessage[] = [
    { role: 'system', content: prompts[type] },
    { role: 'user', content: `Here is the data:\n${JSON.stringify(data, null, 2)}` },
  ];

  try {
    const response = await chatCompletion(messages, {
      taskType: 'analysis',
      maxTokens: 1024,
    });

    return response.choices[0]?.message?.content || 'Summary unavailable.';
  } catch (error) {
    return `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Technical indicator calculations
function calculateRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1];
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(values: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  ema[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  return ema;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine[i] = ema12[i] - ema26[i];
  }

  const signalLine = calculateEMA(macdLine.slice(-9), 9);
  const signal = signalLine[signalLine.length - 1];
  const macd = macdLine[macdLine.length - 1];

  return {
    macd: Math.round(macd * 100) / 100,
    signal: Math.round(signal * 100) / 100,
    histogram: Math.round((macd - signal) * 100) / 100,
  };
}

// Main standalone runner
export async function runStandaloneAnalysis(
  symbol: string,
  type: StandaloneType
): Promise<StandaloneResult> {
  switch (type) {
    case 'technical':
      return runTechnicalAnalysis(symbol);
    case 'fundamentals':
      return runFundamentalsAnalysis(symbol);
    case 'earnings':
      return runEarningsAnalysis(symbol);
    case 'news':
      return runNewsAnalysis(symbol);
    case 'smart_money':
      return runSmartMoneyAnalysis(symbol);
    default:
      throw new Error(`Unknown standalone type: ${type}`);
  }
}
