import { OHLCVBar, StockQuote, NewsArticle, NewsSentiment } from '@/types/market-data';
import { subDays, format } from 'date-fns';

const POLYGON_BASE_URL = 'https://api.polygon.io';

function getApiKey(): string {
  const key = process.env.POLYGON_API_KEY;
  if (!key) {
    throw new Error('POLYGON_API_KEY not configured');
  }
  return key;
}

async function polygonFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${POLYGON_BASE_URL}${endpoint}`);
  url.searchParams.set('apiKey', getApiKey());
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Polygon API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Get current stock quote
export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const upperSymbol = symbol.toUpperCase();

  // Get previous day's data for comparison
  interface SnapshotResponse {
    ticker: {
      ticker: string;
      todaysChangePerc: number;
      todaysChange: number;
      day: {
        o: number;
        h: number;
        l: number;
        c: number;
        v: number;
        vw: number;
      };
      prevDay: {
        c: number;
        v: number;
      };
      min: {
        c: number;
      };
    };
    status: string;
  }

  const snapshot = await polygonFetch<SnapshotResponse>(`/v2/snapshot/locale/us/markets/stocks/tickers/${upperSymbol}`);

  const ticker = snapshot.ticker;

  return {
    symbol: upperSymbol,
    price: ticker.min?.c || ticker.day?.c || 0,
    change: ticker.todaysChange || 0,
    change_percent: ticker.todaysChangePerc || 0,
    volume: ticker.day?.v || 0,
    avg_volume: ticker.prevDay?.v || 0,
    market_cap: null, // Would need separate endpoint
    high_52w: null,
    low_52w: null,
    timestamp: Date.now(),
  };
}

// Get historical OHLCV data
export async function getHistoricalData(
  symbol: string,
  timeframe: '1d' | '1w' | '1m' | '3m' | '6m' | '1y' = '3m',
  interval: '1min' | '5min' | '15min' | '1hour' | '1day' = '1day'
): Promise<OHLCVBar[]> {
  const upperSymbol = symbol.toUpperCase();

  // Calculate date range
  const endDate = new Date();
  let startDate: Date;

  switch (timeframe) {
    case '1d':
      startDate = subDays(endDate, 1);
      break;
    case '1w':
      startDate = subDays(endDate, 7);
      break;
    case '1m':
      startDate = subDays(endDate, 30);
      break;
    case '3m':
      startDate = subDays(endDate, 90);
      break;
    case '6m':
      startDate = subDays(endDate, 180);
      break;
    case '1y':
      startDate = subDays(endDate, 365);
      break;
  }

  // Map interval to Polygon's multiplier and timespan
  let multiplier = 1;
  let timespan = 'day';

  switch (interval) {
    case '1min':
      timespan = 'minute';
      break;
    case '5min':
      multiplier = 5;
      timespan = 'minute';
      break;
    case '15min':
      multiplier = 15;
      timespan = 'minute';
      break;
    case '1hour':
      timespan = 'hour';
      break;
    case '1day':
      timespan = 'day';
      break;
  }

  interface AggregatesResponse {
    results?: Array<{
      t: number;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
      vw?: number;
      n?: number;
    }>;
    status: string;
  }

  const response = await polygonFetch<AggregatesResponse>(
    `/v2/aggs/ticker/${upperSymbol}/range/${multiplier}/${timespan}/${format(startDate, 'yyyy-MM-dd')}/${format(endDate, 'yyyy-MM-dd')}`,
    { adjusted: 'true', sort: 'asc', limit: '5000' }
  );

  if (!response.results) {
    return [];
  }

  return response.results.map((bar) => ({
    timestamp: bar.t,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    vwap: bar.vw,
    transactions: bar.n,
  }));
}

// Get stock news
export async function getStockNews(
  symbol: string,
  days: number = 7
): Promise<NewsArticle[]> {
  const upperSymbol = symbol.toUpperCase();
  const publishedAfter = format(subDays(new Date(), days), 'yyyy-MM-dd');

  interface NewsResponse {
    results?: Array<{
      id: string;
      title: string;
      description?: string;
      article_url: string;
      publisher: { name: string };
      published_utc: string;
      tickers: string[];
      insights?: Array<{
        sentiment: string;
        sentiment_reasoning: string;
      }>;
    }>;
    status: string;
  }

  const response = await polygonFetch<NewsResponse>('/v2/reference/news', {
    ticker: upperSymbol,
    'published_utc.gte': publishedAfter,
    order: 'desc',
    limit: '50',
  });

  if (!response.results) {
    return [];
  }

  return response.results.map((article) => {
    // Map Polygon's sentiment
    let sentiment: 'positive' | 'negative' | 'neutral' | null = null;
    let sentimentScore: number | null = null;

    if (article.insights && article.insights.length > 0) {
      const insight = article.insights[0];
      if (insight.sentiment === 'positive') {
        sentiment = 'positive';
        sentimentScore = 0.5;
      } else if (insight.sentiment === 'negative') {
        sentiment = 'negative';
        sentimentScore = -0.5;
      } else {
        sentiment = 'neutral';
        sentimentScore = 0;
      }
    }

    return {
      id: article.id,
      title: article.title,
      summary: article.description || '',
      url: article.article_url,
      source: article.publisher.name,
      published_at: article.published_utc,
      symbols: article.tickers,
      sentiment,
      sentiment_score: sentimentScore,
    };
  });
}

// Get news sentiment analysis
export async function getNewsSentiment(
  symbol: string,
  days: number = 7
): Promise<NewsSentiment> {
  const articles = await getStockNews(symbol, days);

  // Calculate overall sentiment
  let positiveCount = 0;
  let negativeCount = 0;
  let totalScore = 0;
  let scoredArticles = 0;

  for (const article of articles) {
    if (article.sentiment === 'positive') positiveCount++;
    if (article.sentiment === 'negative') negativeCount++;
    if (article.sentiment_score !== null) {
      totalScore += article.sentiment_score;
      scoredArticles++;
    }
  }

  const avgScore = scoredArticles > 0 ? totalScore / scoredArticles : 0;

  let overallSentiment: 'bullish' | 'bearish' | 'neutral';
  if (avgScore > 0.2) {
    overallSentiment = 'bullish';
  } else if (avgScore < -0.2) {
    overallSentiment = 'bearish';
  } else {
    overallSentiment = 'neutral';
  }

  return {
    symbol: symbol.toUpperCase(),
    articles,
    overall_sentiment: overallSentiment,
    sentiment_score: avgScore,
    article_count: articles.length,
    period: `${days} days`,
  };
}
