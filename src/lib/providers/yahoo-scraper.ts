import * as cheerio from 'cheerio';
import { EarningsCalendar, EarningsEvent, AnalystConsensus, AnalystRating } from '@/types/market-data';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'application/json,text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.5',
  };
}

// Use Yahoo Finance's public v8 API (v10 requires auth)
const YAHOO_V8_API = 'https://query2.finance.yahoo.com/v8/finance';
const YAHOO_V6_API = 'https://query1.finance.yahoo.com/v6/finance';

interface YahooQuoteSummary {
  quoteSummary?: {
    result?: Array<{
      calendarEvents?: {
        earnings?: {
          earningsDate?: Array<{ raw: number; fmt: string }>;
          earningsAverage?: { raw: number };
          earningsLow?: { raw: number };
          earningsHigh?: { raw: number };
          revenueAverage?: { raw: number };
          revenueLow?: { raw: number };
          revenueHigh?: { raw: number };
        };
      };
      recommendationTrend?: {
        trend?: Array<{
          period: string;
          strongBuy: number;
          buy: number;
          hold: number;
          sell: number;
          strongSell: number;
        }>;
      };
      financialData?: {
        targetHighPrice?: { raw: number };
        targetLowPrice?: { raw: number };
        targetMeanPrice?: { raw: number };
        targetMedianPrice?: { raw: number };
        recommendationKey?: string;
        numberOfAnalystOpinions?: { raw: number };
      };
      earnings?: {
        earningsChart?: {
          quarterly?: Array<{
            date: string;
            actual: { raw: number };
            estimate: { raw: number };
          }>;
          currentQuarterEstimate?: { raw: number };
          currentQuarterEstimateDate?: string;
          currentQuarterEstimateYear?: number;
        };
      };
      summaryDetail?: {
        trailingPE?: { raw: number };
        forwardPE?: { raw: number };
        marketCap?: { raw: number };
        fiftyTwoWeekHigh?: { raw: number };
        fiftyTwoWeekLow?: { raw: number };
        dividendYield?: { raw: number };
        beta?: { raw: number };
      };
      summaryProfile?: {
        sector?: string;
        industry?: string;
        fullTimeEmployees?: number;
        longBusinessSummary?: string;
        website?: string;
      };
      price?: {
        shortName?: string;
        longName?: string;
      };
    }>;
    error?: { code: string; description: string };
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Yahoo v6 quote summary - still publicly accessible
interface YahooV6Response {
  quoteSummary?: {
    result?: Array<{
      calendarEvents?: {
        earnings?: {
          earningsDate?: Array<{ raw: number; fmt: string }>;
          earningsAverage?: { raw: number };
          revenueAverage?: { raw: number };
        };
      };
      recommendationTrend?: {
        trend?: Array<{
          period: string;
          strongBuy: number;
          buy: number;
          hold: number;
          sell: number;
          strongSell: number;
        }>;
      };
      financialData?: {
        targetHighPrice?: { raw: number };
        targetLowPrice?: { raw: number };
        targetMeanPrice?: { raw: number };
        recommendationKey?: string;
      };
      summaryDetail?: {
        trailingPE?: { raw: number };
        forwardPE?: { raw: number };
        marketCap?: { raw: number };
        fiftyTwoWeekHigh?: { raw: number };
        fiftyTwoWeekLow?: { raw: number };
        dividendYield?: { raw: number };
        beta?: { raw: number };
      };
      summaryProfile?: {
        sector?: string;
        industry?: string;
        fullTimeEmployees?: number;
        longBusinessSummary?: string;
        website?: string;
      };
      price?: {
        shortName?: string;
        longName?: string;
      };
      earnings?: {
        earningsChart?: {
          quarterly?: Array<{
            date: string;
            actual: { raw: number };
            estimate: { raw: number };
          }>;
        };
      };
    }>;
  };
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Yahoo API timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

async function fetchYahooV6(symbol: string, modules: string[], retries = 2): Promise<YahooV6Response> {
  // v6 quoteSummary endpoint
  const url = `${YAHOO_V6_API}/quoteSummary/${symbol.toUpperCase()}?modules=${modules.join(',')}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await sleep(500 * attempt); // Shorter backoff
    }

    try {
      const response = await fetchWithTimeout(url, { headers: getHeaders() }, 5000);

      if (response.ok) {
        return response.json();
      }

      if (response.status === 429 && attempt < retries - 1) {
        console.log(`Yahoo API rate limited, retrying...`);
        continue;
      }

      // Yahoo API often returns 401/403 now - don't retry, just return empty
      if (response.status === 401 || response.status === 403) {
        console.log(`Yahoo API auth error (${response.status}) for ${symbol} - API may be blocked`);
        return { quoteSummary: { result: [] } };
      }

      throw new Error(`Yahoo API error: ${response.status}`);
    } catch (error) {
      console.error(`Yahoo API attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
      if (attempt === retries - 1) {
        // Return empty instead of throwing to prevent hanging
        return { quoteSummary: { result: [] } };
      }
    }
  }

  return { quoteSummary: { result: [] } };
}

// Legacy function for backward compatibility
async function fetchYahooAPI(symbol: string, modules: string[], retries = 3): Promise<YahooQuoteSummary> {
  const result = await fetchYahooV6(symbol, modules, retries);
  return result as YahooQuoteSummary;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function parseNumber(text: string | undefined | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[,$%]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseBillions(text: string | undefined | null): number | null {
  if (!text) return null;
  const cleaned = text.trim().toUpperCase();
  const num = parseFloat(cleaned.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return null;

  if (cleaned.includes('T')) return num * 1_000_000_000_000;
  if (cleaned.includes('B')) return num * 1_000_000_000;
  if (cleaned.includes('M')) return num * 1_000_000;
  if (cleaned.includes('K')) return num * 1_000;
  return num;
}

// Get earnings data from Yahoo Finance using JSON API
export async function scrapeYahooEarnings(symbol: string): Promise<EarningsCalendar> {
  const upperSymbol = symbol.toUpperCase();

  try {
    const data = await fetchYahooAPI(upperSymbol, ['calendarEvents', 'earnings']);
    const result = data.quoteSummary?.result?.[0];

    const upcoming: EarningsEvent[] = [];
    const recent: EarningsEvent[] = [];

    if (result) {
      // Get upcoming earnings from calendarEvents
      const calendarEarnings = result.calendarEvents?.earnings;
      if (calendarEarnings) {
        const earningsDate = calendarEarnings.earningsDate?.[0];
        const today = new Date();
        const quarter = Math.ceil((today.getMonth() + 1) / 3);

        if (earningsDate) {
          const dateStr = new Date(earningsDate.raw * 1000).toISOString().split('T')[0];
          upcoming.push({
            symbol: upperSymbol,
            report_date: dateStr,
            fiscal_quarter: `Q${quarter}`,
            fiscal_year: today.getFullYear(),
            eps_estimate: calendarEarnings.earningsAverage?.raw ?? null,
            eps_actual: null,
            eps_surprise: null,
            revenue_estimate: calendarEarnings.revenueAverage?.raw ?? null,
            revenue_actual: null,
            revenue_surprise: null,
            time: null,
          });
        }
      }

      // Get historical earnings from earnings chart
      const earningsChart = result.earnings?.earningsChart;
      if (earningsChart?.quarterly) {
        for (const q of earningsChart.quarterly) {
          recent.push({
            symbol: upperSymbol,
            report_date: q.date,
            fiscal_quarter: q.date,
            fiscal_year: parseInt(q.date.slice(-4)) || new Date().getFullYear(),
            eps_estimate: q.estimate?.raw ?? null,
            eps_actual: q.actual?.raw ?? null,
            eps_surprise: q.actual?.raw && q.estimate?.raw
              ? q.actual.raw - q.estimate.raw
              : null,
            revenue_estimate: null,
            revenue_actual: null,
            revenue_surprise: null,
            time: null,
          });
        }
      }
    }

    return {
      symbol: upperSymbol,
      upcoming,
      recent,
    };
  } catch (error) {
    console.error(`Yahoo API error for ${symbol}:`, error);
    return {
      symbol: upperSymbol,
      upcoming: [],
      recent: [],
    };
  }
}

// Get analyst ratings from Yahoo Finance using JSON API
export async function scrapeYahooAnalystRatings(symbol: string): Promise<AnalystConsensus> {
  const upperSymbol = symbol.toUpperCase();

  try {
    const data = await fetchYahooAPI(upperSymbol, ['recommendationTrend', 'financialData']);
    const result = data.quoteSummary?.result?.[0];

    let buyCount = 0;
    let holdCount = 0;
    let sellCount = 0;
    let avgPriceTarget: number | null = null;
    let highPriceTarget: number | null = null;
    let lowPriceTarget: number | null = null;

    if (result) {
      // Get recommendation trend (current month)
      const trends = result.recommendationTrend?.trend;
      const currentTrend = trends?.find(t => t.period === '0m') || trends?.[0];

      if (currentTrend) {
        buyCount = (currentTrend.strongBuy || 0) + (currentTrend.buy || 0);
        holdCount = currentTrend.hold || 0;
        sellCount = (currentTrend.sell || 0) + (currentTrend.strongSell || 0);
      }

      // Get price targets from financialData
      const financialData = result.financialData;
      if (financialData) {
        avgPriceTarget = financialData.targetMeanPrice?.raw ?? financialData.targetMedianPrice?.raw ?? null;
        highPriceTarget = financialData.targetHighPrice?.raw ?? null;
        lowPriceTarget = financialData.targetLowPrice?.raw ?? null;
      }
    }

    // Determine consensus
    const totalRatings = buyCount + holdCount + sellCount;
    let consensus: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' = 'hold';

    if (totalRatings > 0) {
      const buyRatio = buyCount / totalRatings;
      const sellRatio = sellCount / totalRatings;

      if (buyRatio >= 0.7) consensus = 'strong_buy';
      else if (buyRatio >= 0.5) consensus = 'buy';
      else if (sellRatio >= 0.7) consensus = 'strong_sell';
      else if (sellRatio >= 0.5) consensus = 'sell';
    }

    return {
      symbol: upperSymbol,
      ratings: [],
      buy_count: buyCount,
      hold_count: holdCount,
      sell_count: sellCount,
      avg_price_target: avgPriceTarget,
      high_price_target: highPriceTarget,
      low_price_target: lowPriceTarget,
      consensus,
    };
  } catch (error) {
    console.error(`Yahoo API analyst error for ${symbol}:`, error);
    return {
      symbol: upperSymbol,
      ratings: [],
      buy_count: 0,
      hold_count: 0,
      sell_count: 0,
      avg_price_target: null,
      high_price_target: null,
      low_price_target: null,
      consensus: 'hold',
    };
  }
}

// Get key statistics from Yahoo Finance using JSON API
export async function scrapeYahooKeyStats(symbol: string): Promise<{
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToBook: number | null;
  beta: number | null;
  week52High: number | null;
  week52Low: number | null;
  avgVolume: number | null;
  dividendYield: number | null;
  eps: number | null;
  nextEarningsDate: string | null;
}> {
  const upperSymbol = symbol.toUpperCase();

  const stats = {
    marketCap: null as number | null,
    peRatio: null as number | null,
    forwardPE: null as number | null,
    pegRatio: null as number | null,
    priceToBook: null as number | null,
    beta: null as number | null,
    week52High: null as number | null,
    week52Low: null as number | null,
    avgVolume: null as number | null,
    dividendYield: null as number | null,
    eps: null as number | null,
    nextEarningsDate: null as string | null,
  };

  try {
    const data = await fetchYahooAPI(upperSymbol, ['summaryDetail', 'calendarEvents']);
    const result = data.quoteSummary?.result?.[0];

    if (result?.summaryDetail) {
      const detail = result.summaryDetail;
      stats.marketCap = detail.marketCap?.raw ?? null;
      stats.peRatio = detail.trailingPE?.raw ?? null;
      stats.forwardPE = detail.forwardPE?.raw ?? null;
      stats.beta = detail.beta?.raw ?? null;
      stats.week52High = detail.fiftyTwoWeekHigh?.raw ?? null;
      stats.week52Low = detail.fiftyTwoWeekLow?.raw ?? null;
      stats.dividendYield = detail.dividendYield?.raw ? detail.dividendYield.raw * 100 : null;
    }

    if (result?.calendarEvents?.earnings?.earningsDate?.[0]) {
      const earningsTimestamp = result.calendarEvents.earnings.earningsDate[0].raw;
      stats.nextEarningsDate = new Date(earningsTimestamp * 1000).toISOString().split('T')[0];
    }

    return stats;
  } catch (error) {
    console.error(`Yahoo API key stats error for ${symbol}:`, error);
    return stats;
  }
}

// Get stock profile/company info from Yahoo Finance using JSON API
export async function scrapeYahooProfile(symbol: string): Promise<{
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  fullTimeEmployees: number | null;
  description: string | null;
  website: string | null;
}> {
  const upperSymbol = symbol.toUpperCase();

  const profile = {
    companyName: null as string | null,
    sector: null as string | null,
    industry: null as string | null,
    fullTimeEmployees: null as number | null,
    description: null as string | null,
    website: null as string | null,
  };

  try {
    const data = await fetchYahooAPI(upperSymbol, ['summaryProfile', 'price']);
    const result = data.quoteSummary?.result?.[0];

    if (result) {
      // Company name from price module
      if (result.price) {
        profile.companyName = result.price.longName || result.price.shortName || null;
      }

      // Profile data
      if (result.summaryProfile) {
        const p = result.summaryProfile;
        profile.sector = p.sector || null;
        profile.industry = p.industry || null;
        profile.fullTimeEmployees = p.fullTimeEmployees || null;
        profile.description = p.longBusinessSummary || null;
        profile.website = p.website || null;
      }
    }

    return profile;
  } catch (error) {
    console.error(`Yahoo API profile error for ${symbol}:`, error);
    return profile;
  }
}
