// Twelve Data API - Forex and Stock Data
import { ForexQuote, OHLCVBar } from '@/types/market-data';

const TWELVEDATA_BASE_URL = 'https://api.twelvedata.com';

function getApiKey(): string {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) {
    throw new Error('TWELVEDATA_API_KEY not configured');
  }
  return key;
}

async function twelvedataFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TWELVEDATA_BASE_URL}${endpoint}`);
  url.searchParams.set('apikey', getApiKey());
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twelve Data API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Check for API-level errors
  if (data.status === 'error') {
    throw new Error(`Twelve Data API error: ${data.message}`);
  }

  return data;
}

interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  datetime: string;
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
  previous_close: string;
  change: string;
  percent_change: string;
  is_market_open: boolean;
}

interface TwelveDataTimeSeries {
  meta: {
    symbol: string;
    interval: string;
    currency_base?: string;
    currency_quote?: string;
    type: string;
  };
  values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
  status: string;
}

interface TwelveDataExchangeRate {
  symbol: string;
  rate: number;
  timestamp: number;
}

// Get real-time forex quote
export async function getForexQuote(pair: string): Promise<ForexQuote> {
  // Format pair for Twelve Data (e.g., "EUR/USD")
  const formattedPair = pair.includes('/') ? pair : `${pair.slice(0, 3)}/${pair.slice(3)}`;

  const data = await twelvedataFetch<TwelveDataQuote>('/quote', {
    symbol: formattedPair,
  });

  const price = parseFloat(data.close);
  const spread = 0.0001; // Typical forex spread

  return {
    pair: formattedPair.replace('/', ''),
    bid: price - spread / 2,
    ask: price + spread / 2,
    mid: price,
    spread,
    timestamp: data.timestamp * 1000,
  };
}

// Get forex exchange rate
export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<{
  rate: number;
  timestamp: number;
}> {
  const data = await twelvedataFetch<TwelveDataExchangeRate>('/exchange_rate', {
    symbol: `${fromCurrency}/${toCurrency}`,
  });

  return {
    rate: data.rate,
    timestamp: data.timestamp * 1000,
  };
}

// Get forex historical data (OHLCV)
export async function getForexHistoricalData(
  pair: string,
  interval: '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day' | '1week' | '1month' = '1day',
  outputSize: number = 100
): Promise<OHLCVBar[]> {
  const formattedPair = pair.includes('/') ? pair : `${pair.slice(0, 3)}/${pair.slice(3)}`;

  const data = await twelvedataFetch<TwelveDataTimeSeries>('/time_series', {
    symbol: formattedPair,
    interval,
    outputsize: outputSize.toString(),
  });

  return (data.values || []).map((bar) => ({
    timestamp: new Date(bar.datetime).getTime(),
    open: parseFloat(bar.open),
    high: parseFloat(bar.high),
    low: parseFloat(bar.low),
    close: parseFloat(bar.close),
    volume: bar.volume ? parseFloat(bar.volume) : 0,
  })).reverse(); // Reverse to get chronological order
}

// Get multiple forex quotes at once
export async function getMultipleForexQuotes(pairs: string[]): Promise<ForexQuote[]> {
  const formattedPairs = pairs.map(p =>
    p.includes('/') ? p : `${p.slice(0, 3)}/${p.slice(3)}`
  );

  const data = await twelvedataFetch<Record<string, TwelveDataQuote>>('/quote', {
    symbol: formattedPairs.join(','),
  });

  const quotes: ForexQuote[] = [];

  for (const pair of formattedPairs) {
    const quote = data[pair];
    if (quote) {
      const price = parseFloat(quote.close);
      const spread = 0.0001;
      quotes.push({
        pair: pair.replace('/', ''),
        bid: price - spread / 2,
        ask: price + spread / 2,
        mid: price,
        spread,
        timestamp: quote.timestamp * 1000,
      });
    }
  }

  return quotes;
}

// Get available forex pairs
export async function getForexPairsList(): Promise<Array<{
  symbol: string;
  currency_base: string;
  currency_quote: string;
}>> {
  interface ForexPair {
    symbol: string;
    currency_base: string;
    currency_quote: string;
  }

  const data = await twelvedataFetch<{ data: ForexPair[] }>('/forex_pairs');
  return data.data || [];
}

// Get forex technical indicators
export async function getForexIndicator(
  pair: string,
  indicator: 'sma' | 'ema' | 'rsi' | 'macd' | 'bbands' | 'atr',
  interval: '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day' = '1day',
  timePeriod: number = 14,
  outputSize: number = 30
): Promise<Array<{ datetime: string; value: number | Record<string, number> }>> {
  const formattedPair = pair.includes('/') ? pair : `${pair.slice(0, 3)}/${pair.slice(3)}`;

  interface IndicatorResponse {
    values: Array<{
      datetime: string;
      [key: string]: string;
    }>;
  }

  const data = await twelvedataFetch<IndicatorResponse>(`/${indicator}`, {
    symbol: formattedPair,
    interval,
    time_period: timePeriod.toString(),
    outputsize: outputSize.toString(),
  });

  const results: Array<{ datetime: string; value: number | Record<string, number> }> = [];

  for (const item of data.values || []) {
    const { datetime, ...values } = item;

    // Handle different indicator outputs
    if (indicator === 'macd') {
      results.push({
        datetime,
        value: {
          macd: parseFloat(values.macd || '0'),
          macd_signal: parseFloat(values.macd_signal || '0'),
          macd_hist: parseFloat(values.macd_hist || '0'),
        } as Record<string, number>,
      });
    } else if (indicator === 'bbands') {
      results.push({
        datetime,
        value: {
          upper_band: parseFloat(values.upper_band || '0'),
          middle_band: parseFloat(values.middle_band || '0'),
          lower_band: parseFloat(values.lower_band || '0'),
        } as Record<string, number>,
      });
    } else {
      // SMA, EMA, RSI, ATR return single values
      const valueKey = Object.keys(values)[0];
      results.push({
        datetime,
        value: parseFloat(values[valueKey] || '0'),
      });
    }
  }

  return results.reverse();
}

// Get crypto quote (Twelve Data also supports crypto)
export async function getCryptoQuote(symbol: string): Promise<{
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}> {
  // Format: BTC/USD
  const formattedSymbol = symbol.includes('/') ? symbol : `${symbol}/USD`;

  const data = await twelvedataFetch<TwelveDataQuote>('/quote', {
    symbol: formattedSymbol,
  });

  return {
    symbol: formattedSymbol,
    price: parseFloat(data.close),
    change: parseFloat(data.change),
    changePercent: parseFloat(data.percent_change),
    high24h: parseFloat(data.high),
    low24h: parseFloat(data.low),
    volume24h: data.volume ? parseFloat(data.volume) : 0,
    timestamp: data.timestamp * 1000,
  };
}
