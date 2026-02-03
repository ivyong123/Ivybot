import { EarningsCalendar, EarningsEvent, AnalystRating, AnalystConsensus } from '@/types/market-data';
import { format, addDays, subDays } from 'date-fns';

const BENZINGA_BASE_URL = 'https://api.benzinga.com/api/v2.1';

function getApiKey(): string {
  const key = process.env.BENZINGA_API_KEY;
  if (!key) {
    throw new Error('BENZINGA_API_KEY not configured');
  }
  return key;
}

async function benzingaFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BENZINGA_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-BENZ-API-KEY': getApiKey(),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Benzinga API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Get earnings calendar for a symbol
export async function getEarningsCalendar(symbol: string): Promise<EarningsCalendar> {
  const upperSymbol = symbol.toUpperCase();
  const today = new Date();

  // Get upcoming earnings (next 90 days)
  const futureDate = format(addDays(today, 90), 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');

  // Get recent earnings (past 90 days)
  const pastDate = format(subDays(today, 90), 'yyyy-MM-dd');

  interface BenzingaEarning {
    id: string;
    date: string;
    date_confirmed: string;
    time: string;
    ticker: string;
    exchange: string;
    name: string;
    period: string;
    period_year: number;
    eps_est: string | null;
    eps_actual: string | null;
    eps_surprise: string | null;
    revenue_est: string | null;
    revenue_actual: string | null;
    revenue_surprise: string | null;
  }

  interface EarningsResponse {
    earnings: BenzingaEarning[];
  }

  // Fetch upcoming and recent in parallel
  const [upcomingResponse, recentResponse] = await Promise.all([
    benzingaFetch<EarningsResponse>('/calendar/earnings', {
      tickers: upperSymbol,
      date_from: todayStr,
      date_to: futureDate,
    }),
    benzingaFetch<EarningsResponse>('/calendar/earnings', {
      tickers: upperSymbol,
      date_from: pastDate,
      date_to: todayStr,
    }),
  ]);

  const mapEarning = (e: BenzingaEarning): EarningsEvent => ({
    symbol: e.ticker,
    report_date: e.date,
    fiscal_quarter: e.period,
    fiscal_year: e.period_year,
    eps_estimate: e.eps_est ? parseFloat(e.eps_est) : null,
    eps_actual: e.eps_actual ? parseFloat(e.eps_actual) : null,
    eps_surprise: e.eps_surprise ? parseFloat(e.eps_surprise) : null,
    revenue_estimate: e.revenue_est ? parseFloat(e.revenue_est) : null,
    revenue_actual: e.revenue_actual ? parseFloat(e.revenue_actual) : null,
    revenue_surprise: e.revenue_surprise ? parseFloat(e.revenue_surprise) : null,
    time: e.time === 'Before Open' ? 'before_market' :
          e.time === 'After Close' ? 'after_market' :
          e.time === 'During Market' ? 'during_market' : null,
  });

  return {
    symbol: upperSymbol,
    upcoming: (upcomingResponse.earnings || []).map(mapEarning),
    recent: (recentResponse.earnings || []).map(mapEarning),
  };
}

// Get analyst ratings for a symbol
export async function getAnalystRatings(symbol: string, limit: number = 10): Promise<AnalystConsensus> {
  const upperSymbol = symbol.toUpperCase();

  interface BenzingaRating {
    id: string;
    date: string;
    ticker: string;
    analyst: string;
    analyst_name: string;
    rating_current: string;
    rating_prior: string | null;
    pt_current: string | null;
    pt_prior: string | null;
    action_company: string;
    action_pt: string;
  }

  interface RatingsResponse {
    ratings: BenzingaRating[];
  }

  const response = await benzingaFetch<RatingsResponse>('/calendar/ratings', {
    tickers: upperSymbol,
    pagesize: limit.toString(),
  });

  const ratings: AnalystRating[] = (response.ratings || []).map((r) => {
    // Determine action type
    let action: 'upgrade' | 'downgrade' | 'maintain' | 'initiate' = 'maintain';
    if (r.action_company.toLowerCase().includes('upgrade')) {
      action = 'upgrade';
    } else if (r.action_company.toLowerCase().includes('downgrade')) {
      action = 'downgrade';
    } else if (r.action_company.toLowerCase().includes('initiate') ||
               r.action_company.toLowerCase().includes('start')) {
      action = 'initiate';
    }

    return {
      symbol: r.ticker,
      analyst: r.analyst_name,
      firm: r.analyst,
      rating: r.rating_current,
      rating_prior: r.rating_prior,
      price_target: r.pt_current ? parseFloat(r.pt_current) : null,
      price_target_prior: r.pt_prior ? parseFloat(r.pt_prior) : null,
      action,
      date: r.date,
    };
  });

  // Calculate consensus
  let buyCount = 0;
  let holdCount = 0;
  let sellCount = 0;
  const priceTargets: number[] = [];

  for (const rating of ratings) {
    const ratingLower = rating.rating.toLowerCase();
    if (ratingLower.includes('buy') || ratingLower.includes('outperform') ||
        ratingLower.includes('overweight')) {
      buyCount++;
    } else if (ratingLower.includes('sell') || ratingLower.includes('underperform') ||
               ratingLower.includes('underweight')) {
      sellCount++;
    } else {
      holdCount++;
    }

    if (rating.price_target) {
      priceTargets.push(rating.price_target);
    }
  }

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
    ratings,
    buy_count: buyCount,
    hold_count: holdCount,
    sell_count: sellCount,
    avg_price_target: priceTargets.length > 0
      ? priceTargets.reduce((a, b) => a + b, 0) / priceTargets.length
      : null,
    high_price_target: priceTargets.length > 0 ? Math.max(...priceTargets) : null,
    low_price_target: priceTargets.length > 0 ? Math.min(...priceTargets) : null,
    consensus,
  };
}
