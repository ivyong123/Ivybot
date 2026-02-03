import { OptionsChain, OptionContract } from '@/types/market-data';
import { format, addMonths } from 'date-fns';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error('FINNHUB_API_KEY not configured');
  }
  return key;
}

async function finnhubFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);
  url.searchParams.set('token', getApiKey());
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Finnhub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Get stock quote for underlying price
async function getQuote(symbol: string): Promise<number> {
  interface QuoteResponse {
    c: number; // Current price
    d: number; // Change
    dp: number; // Change percent
    h: number; // High
    l: number; // Low
    o: number; // Open
    pc: number; // Previous close
    t: number; // Timestamp
  }

  const response = await finnhubFetch<QuoteResponse>('/quote', { symbol: symbol.toUpperCase() });
  return response.c;
}

// Get options chain for a symbol
export async function getOptionsChain(
  symbol: string,
  expirationDate?: string
): Promise<OptionsChain> {
  const upperSymbol = symbol.toUpperCase();

  interface FinnhubOption {
    contractName: string;
    strike: number;
    lastPrice: number;
    bid: number;
    ask: number;
    change: number;
    percentChange: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    inTheMoney: boolean;
    contractSize: string;
    expirationDate: string;
    // Greeks (may not always be available)
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  }

  interface OptionsResponse {
    code: string;
    data: Array<{
      expirationDate: string;
      options: {
        CALL: FinnhubOption[];
        PUT: FinnhubOption[];
      };
    }>;
  }

  // Get the underlying price
  const underlyingPrice = await getQuote(upperSymbol);

  // Get options chain
  const response = await finnhubFetch<OptionsResponse>('/stock/option-chain', {
    symbol: upperSymbol,
  });

  if (!response.data || response.data.length === 0) {
    return {
      symbol: upperSymbol,
      underlying_price: underlyingPrice,
      expiration_dates: [],
      calls: [],
      puts: [],
      timestamp: Date.now(),
    };
  }

  // Get all expiration dates
  const expirationDates = response.data.map((d) => d.expirationDate);

  // Filter by expiration date if provided, otherwise get the nearest expiration
  let selectedData = response.data[0];

  if (expirationDate) {
    const found = response.data.find((d) => d.expirationDate === expirationDate);
    if (found) {
      selectedData = found;
    }
  }

  const mapOption = (opt: FinnhubOption, optionType: 'call' | 'put'): OptionContract => ({
    symbol: opt.contractName,
    underlying: upperSymbol,
    expiration: opt.expirationDate,
    strike: opt.strike,
    option_type: optionType,
    bid: opt.bid,
    ask: opt.ask,
    last: opt.lastPrice,
    volume: opt.volume,
    open_interest: opt.openInterest,
    implied_volatility: opt.impliedVolatility,
    delta: opt.delta ?? null,
    gamma: opt.gamma ?? null,
    theta: opt.theta ?? null,
    vega: opt.vega ?? null,
    in_the_money: opt.inTheMoney,
  });

  const calls = (selectedData.options.CALL || []).map((opt) => mapOption(opt, 'call'));
  const puts = (selectedData.options.PUT || []).map((opt) => mapOption(opt, 'put'));

  return {
    symbol: upperSymbol,
    underlying_price: underlyingPrice,
    expiration_dates: expirationDates,
    calls,
    puts,
    timestamp: Date.now(),
  };
}

// Get nearby expiration dates for options
export async function getOptionsExpirations(symbol: string): Promise<string[]> {
  const chain = await getOptionsChain(symbol);
  return chain.expiration_dates;
}

// Get earnings calendar from Finnhub (free alternative to Benzinga)
export async function getFinnhubEarnings(symbol: string): Promise<{
  upcoming: Array<{ date: string; epsEstimate: number | null; revenueEstimate: number | null; quarter: number; year: number }>;
  recent: Array<{ date: string; epsActual: number | null; epsEstimate: number | null; epsSurprise: number | null; quarter: number; year: number }>;
}> {
  const upperSymbol = symbol.toUpperCase();

  interface EarningsItem {
    date: string;
    epsActual: number | null;
    epsEstimate: number | null;
    hour: string;
    quarter: number;
    revenueActual: number | null;
    revenueEstimate: number | null;
    symbol: string;
    year: number;
  }

  interface EarningsResponse {
    earningsCalendar: EarningsItem[];
  }

  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setMonth(fromDate.getMonth() - 6);
  const toDate = new Date(today);
  toDate.setMonth(toDate.getMonth() + 3);

  const response = await finnhubFetch<EarningsResponse>('/calendar/earnings', {
    symbol: upperSymbol,
    from: fromDate.toISOString().split('T')[0],
    to: toDate.toISOString().split('T')[0],
  });

  // Finnhub returns { earningsCalendar: [...] }
  const earnings = response?.earningsCalendar || [];
  const todayStr = today.toISOString().split('T')[0];

  const upcoming = earnings
    .filter(e => e.date >= todayStr)
    .map(e => ({
      date: e.date,
      epsEstimate: e.epsEstimate,
      revenueEstimate: e.revenueEstimate,
      quarter: e.quarter,
      year: e.year,
    }));

  const recent = earnings
    .filter(e => e.date < todayStr)
    .map(e => ({
      date: e.date,
      epsActual: e.epsActual,
      epsEstimate: e.epsEstimate,
      epsSurprise: e.epsActual && e.epsEstimate ? e.epsActual - e.epsEstimate : null,
      quarter: e.quarter,
      year: e.year,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return { upcoming, recent };
}

// Get analyst recommendations from Finnhub (free alternative to Benzinga)
export async function getFinnhubRecommendations(symbol: string): Promise<{
  consensus: string;
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  targetHigh: number | null;
  targetLow: number | null;
  targetMean: number | null;
  targetMedian: number | null;
}> {
  const upperSymbol = symbol.toUpperCase();

  interface RecommendationItem {
    buy: number;
    hold: number;
    period: string;
    sell: number;
    strongBuy: number;
    strongSell: number;
    symbol: string;
  }

  interface PriceTarget {
    lastUpdated: string;
    symbol: string;
    targetHigh: number;
    targetLow: number;
    targetMean: number;
    targetMedian: number;
  }

  // Fetch recommendations and price targets in parallel
  const [recommendations, priceTarget] = await Promise.all([
    finnhubFetch<RecommendationItem[]>('/stock/recommendation', { symbol: upperSymbol }),
    finnhubFetch<PriceTarget>('/stock/price-target', { symbol: upperSymbol }).catch(() => null),
  ]);

  // Get the most recent recommendation
  const latest = recommendations && recommendations.length > 0 ? recommendations[0] : null;

  if (!latest) {
    return {
      consensus: 'hold',
      buy: 0,
      hold: 0,
      sell: 0,
      strongBuy: 0,
      strongSell: 0,
      targetHigh: null,
      targetLow: null,
      targetMean: null,
      targetMedian: null,
    };
  }

  // Determine consensus
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
  const bullish = latest.strongBuy + latest.buy;
  const bearish = latest.strongSell + latest.sell;

  let consensus = 'hold';
  if (total > 0) {
    const bullishRatio = bullish / total;
    const bearishRatio = bearish / total;
    if (bullishRatio >= 0.7) consensus = 'strong_buy';
    else if (bullishRatio >= 0.5) consensus = 'buy';
    else if (bearishRatio >= 0.7) consensus = 'strong_sell';
    else if (bearishRatio >= 0.5) consensus = 'sell';
  }

  return {
    consensus,
    buy: latest.buy,
    hold: latest.hold,
    sell: latest.sell,
    strongBuy: latest.strongBuy,
    strongSell: latest.strongSell,
    targetHigh: priceTarget?.targetHigh || null,
    targetLow: priceTarget?.targetLow || null,
    targetMean: priceTarget?.targetMean || null,
    targetMedian: priceTarget?.targetMedian || null,
  };
}
