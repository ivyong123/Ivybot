// Financial Modeling Prep API - Free tier alternative
import { EarningsCalendar, EarningsEvent, AnalystConsensus } from '@/types/market-data';

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new Error('FMP_API_KEY not configured');
  }
  return key;
}

async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FMP_BASE_URL}${endpoint}`);
  url.searchParams.set('apikey', getApiKey());
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`FMP API error: ${response.status} - ${error}`);
  }

  return response.json();
}

interface FMPEarningsCalendar {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  time: string;
  revenue: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding: string;
  updatedFromDate: string;
}

interface FMPAnalystEstimates {
  symbol: string;
  date: string;
  estimatedRevenueAvg: number;
  estimatedRevenueHigh: number;
  estimatedRevenueLow: number;
  estimatedEpsAvg: number;
  estimatedEpsHigh: number;
  estimatedEpsLow: number;
  numberAnalystEstimatedRevenue: number;
  numberAnalystsEstimatedEps: number;
}

interface FMPPriceTarget {
  symbol: string;
  publishedDate: string;
  newsURL: string;
  newsTitle: string;
  analystName: string;
  priceTarget: number;
  adjPriceTarget: number;
  priceWhenPosted: number;
  newsPublisher: string;
  analystCompany: string;
}

interface FMPRating {
  symbol: string;
  date: string;
  rating: string;
  ratingScore: number;
  ratingRecommendation: string;
  ratingDetailsDCFScore: number;
  ratingDetailsDCFRecommendation: string;
  ratingDetailsROEScore: number;
  ratingDetailsROERecommendation: string;
  ratingDetailsROAScore: number;
  ratingDetailsROARecommendation: string;
  ratingDetailsDEScore: number;
  ratingDetailsDERecommendation: string;
  ratingDetailsPEScore: number;
  ratingDetailsPERecommendation: string;
  ratingDetailsPBScore: number;
  ratingDetailsPBRecommendation: string;
}

// Get earnings calendar from FMP
export async function getFMPEarnings(symbol: string): Promise<EarningsCalendar> {
  const upperSymbol = symbol.toUpperCase();

  try {
    // Get historical and upcoming earnings
    const [historical, upcoming] = await Promise.all([
      fmpFetch<FMPEarningsCalendar[]>(`/historical/earning_calendar/${upperSymbol}`),
      fmpFetch<FMPEarningsCalendar[]>('/earning_calendar', { symbol: upperSymbol }),
    ]);

    const today = new Date().toISOString().split('T')[0];

    const mapEarning = (e: FMPEarningsCalendar): EarningsEvent => {
      const fiscalDate = new Date(e.fiscalDateEnding);
      const quarter = Math.ceil((fiscalDate.getMonth() + 1) / 3);

      return {
        symbol: e.symbol,
        report_date: e.date,
        fiscal_quarter: `Q${quarter}`,
        fiscal_year: fiscalDate.getFullYear(),
        eps_estimate: e.epsEstimated,
        eps_actual: e.eps,
        eps_surprise: e.eps && e.epsEstimated ? e.eps - e.epsEstimated : null,
        revenue_estimate: e.revenueEstimated,
        revenue_actual: e.revenue,
        revenue_surprise: e.revenue && e.revenueEstimated ? e.revenue - e.revenueEstimated : null,
        time: e.time === 'bmo' ? 'before_market' :
              e.time === 'amc' ? 'after_market' : null,
      };
    };

    return {
      symbol: upperSymbol,
      upcoming: (upcoming || [])
        .filter(e => e.date >= today)
        .map(mapEarning)
        .slice(0, 5),
      recent: (historical || [])
        .filter(e => e.date < today)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(mapEarning)
        .slice(0, 8),
    };
  } catch (error) {
    console.error(`FMP earnings error for ${symbol}:`, error);
    throw error;
  }
}

// Get analyst ratings from FMP
export async function getFMPAnalystRatings(symbol: string): Promise<AnalystConsensus> {
  const upperSymbol = symbol.toUpperCase();

  try {
    const [priceTargets, rating] = await Promise.all([
      fmpFetch<FMPPriceTarget[]>(`/price-target/${upperSymbol}`).catch(() => []),
      fmpFetch<FMPRating[]>(`/rating/${upperSymbol}`).catch(() => []),
    ]);

    // Calculate price target stats
    const recentTargets = (priceTargets || []).slice(0, 20);
    const targetPrices = recentTargets.map(t => t.priceTarget).filter(p => p > 0);

    const avgPriceTarget = targetPrices.length > 0
      ? targetPrices.reduce((a, b) => a + b, 0) / targetPrices.length
      : null;
    const highPriceTarget = targetPrices.length > 0 ? Math.max(...targetPrices) : null;
    const lowPriceTarget = targetPrices.length > 0 ? Math.min(...targetPrices) : null;

    // Get consensus from rating
    const latestRating = rating?.[0];
    let consensus: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' = 'hold';
    let buyCount = 0;
    let holdCount = 0;
    let sellCount = 0;

    if (latestRating) {
      const rec = latestRating.ratingRecommendation?.toLowerCase() || '';
      if (rec.includes('strong buy')) {
        consensus = 'strong_buy';
        buyCount = 5;
      } else if (rec.includes('buy')) {
        consensus = 'buy';
        buyCount = 4;
        holdCount = 1;
      } else if (rec.includes('sell')) {
        consensus = rec.includes('strong') ? 'strong_sell' : 'sell';
        sellCount = 4;
        holdCount = 1;
      } else {
        holdCount = 3;
        buyCount = 1;
        sellCount = 1;
      }
    }

    return {
      symbol: upperSymbol,
      ratings: recentTargets.slice(0, 10).map(t => ({
        symbol: upperSymbol,
        analyst: t.analystName || 'Unknown',
        firm: t.analystCompany || t.newsPublisher || 'Unknown',
        rating: 'Price Target',
        rating_prior: null,
        price_target: t.priceTarget,
        price_target_prior: null,
        action: 'maintain' as const,
        date: t.publishedDate,
      })),
      buy_count: buyCount,
      hold_count: holdCount,
      sell_count: sellCount,
      avg_price_target: avgPriceTarget,
      high_price_target: highPriceTarget,
      low_price_target: lowPriceTarget,
      consensus,
    };
  } catch (error) {
    console.error(`FMP analyst error for ${symbol}:`, error);
    throw error;
  }
}

// Get company profile from FMP
export async function getFMPProfile(symbol: string): Promise<{
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  website: string | null;
  marketCap: number | null;
  beta: number | null;
}> {
  const upperSymbol = symbol.toUpperCase();

  interface FMPProfile {
    symbol: string;
    companyName: string;
    sector: string;
    industry: string;
    description: string;
    website: string;
    mktCap: number;
    beta: number;
  }

  try {
    const profiles = await fmpFetch<FMPProfile[]>(`/profile/${upperSymbol}`);
    const profile = profiles?.[0];

    return {
      companyName: profile?.companyName || null,
      sector: profile?.sector || null,
      industry: profile?.industry || null,
      description: profile?.description || null,
      website: profile?.website || null,
      marketCap: profile?.mktCap || null,
      beta: profile?.beta || null,
    };
  } catch (error) {
    console.error(`FMP profile error for ${symbol}:`, error);
    return {
      companyName: null,
      sector: null,
      industry: null,
      description: null,
      website: null,
      marketCap: null,
      beta: null,
    };
  }
}
