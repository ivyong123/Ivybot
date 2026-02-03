import { EarningsCalendar, EarningsEvent, AnalystConsensus } from '@/types/market-data';
import { getEarningsCalendar as getBenzingaEarnings, getAnalystRatings as getBenzingaAnalyst } from './benzinga';
import { getFinnhubEarnings, getFinnhubRecommendations } from './finnhub';
import { getFMPEarnings, getFMPAnalystRatings } from './fmp';
import { scrapeYahooEarnings, scrapeYahooAnalystRatings, scrapeYahooKeyStats } from './yahoo-scraper';

interface DataSource {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

interface UnifiedEarningsResult {
  data: EarningsCalendar;
  sources: DataSource[];
  primarySource: string;
}

interface UnifiedAnalystResult {
  data: AnalystConsensus;
  sources: DataSource[];
  primarySource: string;
}

// Get earnings data from multiple sources with fallback
export async function getUnifiedEarnings(symbol: string): Promise<UnifiedEarningsResult> {
  const upperSymbol = symbol.toUpperCase();
  const sources: DataSource[] = [];

  // Try Benzinga first (most comprehensive)
  try {
    const benzingaData = await getBenzingaEarnings(upperSymbol);
    if (benzingaData.upcoming.length > 0 || benzingaData.recent.length > 0) {
      sources.push({ name: 'Benzinga', status: 'success' });
      return {
        data: benzingaData,
        sources,
        primarySource: 'Benzinga',
      };
    }
    sources.push({ name: 'Benzinga', status: 'success', error: 'No data returned' });
  } catch (error) {
    sources.push({
      name: 'Benzinga',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Fallback to Finnhub
  try {
    const finnhubData = await getFinnhubEarnings(upperSymbol);

    if (finnhubData.upcoming.length > 0 || finnhubData.recent.length > 0) {
      sources.push({ name: 'Finnhub', status: 'success' });

      const earnings: EarningsCalendar = {
        symbol: upperSymbol,
        upcoming: finnhubData.upcoming.map((e) => ({
          symbol: upperSymbol,
          report_date: e.date,
          fiscal_quarter: `Q${e.quarter}`,
          fiscal_year: e.year,
          eps_estimate: e.epsEstimate,
          eps_actual: null,
          eps_surprise: null,
          revenue_estimate: e.revenueEstimate,
          revenue_actual: null,
          revenue_surprise: null,
          time: null,
        })),
        recent: finnhubData.recent.map((e) => ({
          symbol: upperSymbol,
          report_date: e.date,
          fiscal_quarter: `Q${e.quarter}`,
          fiscal_year: e.year,
          eps_estimate: e.epsEstimate,
          eps_actual: e.epsActual,
          eps_surprise: e.epsSurprise,
          revenue_estimate: null,
          revenue_actual: null,
          revenue_surprise: null,
          time: null,
        })),
      };

      return {
        data: earnings,
        sources,
        primarySource: 'Finnhub',
      };
    }
    sources.push({ name: 'Finnhub', status: 'success', error: 'No data returned' });
  } catch (error) {
    sources.push({
      name: 'Finnhub',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Fallback to Financial Modeling Prep (FMP)
  try {
    const fmpData = await getFMPEarnings(upperSymbol);

    if (fmpData.upcoming.length > 0 || fmpData.recent.length > 0) {
      sources.push({ name: 'FMP', status: 'success' });
      return {
        data: fmpData,
        sources,
        primarySource: 'Financial Modeling Prep',
      };
    }
    sources.push({ name: 'FMP', status: 'success', error: 'No data returned' });
  } catch (error) {
    sources.push({
      name: 'FMP',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Final fallback to Yahoo Finance scraper
  try {
    const yahooData = await scrapeYahooEarnings(upperSymbol);

    sources.push({ name: 'Yahoo Finance (Scraper)', status: 'success' });

    return {
      data: yahooData,
      sources,
      primarySource: 'Yahoo Finance',
    };
  } catch (error) {
    sources.push({
      name: 'Yahoo Finance (Scraper)',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Return empty result if all sources fail
  return {
    data: {
      symbol: upperSymbol,
      upcoming: [],
      recent: [],
    },
    sources,
    primarySource: 'None',
  };
}

// Get analyst ratings from multiple sources with fallback
export async function getUnifiedAnalystRatings(symbol: string): Promise<UnifiedAnalystResult> {
  const upperSymbol = symbol.toUpperCase();
  const sources: DataSource[] = [];

  // Try Benzinga first
  try {
    const benzingaData = await getBenzingaAnalyst(upperSymbol);
    if (benzingaData.ratings.length > 0 || benzingaData.buy_count + benzingaData.hold_count + benzingaData.sell_count > 0) {
      sources.push({ name: 'Benzinga', status: 'success' });
      return {
        data: benzingaData,
        sources,
        primarySource: 'Benzinga',
      };
    }
    sources.push({ name: 'Benzinga', status: 'success', error: 'No data returned' });
  } catch (error) {
    sources.push({
      name: 'Benzinga',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Fallback to Finnhub
  try {
    const finnhubData = await getFinnhubRecommendations(upperSymbol);

    if (finnhubData.buy + finnhubData.hold + finnhubData.sell > 0) {
      sources.push({ name: 'Finnhub', status: 'success' });

      const analystData: AnalystConsensus = {
        symbol: upperSymbol,
        ratings: [],
        buy_count: finnhubData.buy + finnhubData.strongBuy,
        hold_count: finnhubData.hold,
        sell_count: finnhubData.sell + finnhubData.strongSell,
        avg_price_target: finnhubData.targetMean,
        high_price_target: finnhubData.targetHigh,
        low_price_target: finnhubData.targetLow,
        consensus: finnhubData.consensus as 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell',
      };

      return {
        data: analystData,
        sources,
        primarySource: 'Finnhub',
      };
    }
    sources.push({ name: 'Finnhub', status: 'success', error: 'No data returned' });
  } catch (error) {
    sources.push({
      name: 'Finnhub',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Fallback to Financial Modeling Prep (FMP)
  try {
    const fmpData = await getFMPAnalystRatings(upperSymbol);

    if (fmpData.buy_count + fmpData.hold_count + fmpData.sell_count > 0 || fmpData.avg_price_target) {
      sources.push({ name: 'FMP', status: 'success' });
      return {
        data: fmpData,
        sources,
        primarySource: 'Financial Modeling Prep',
      };
    }
    sources.push({ name: 'FMP', status: 'success', error: 'No data returned' });
  } catch (error) {
    sources.push({
      name: 'FMP',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Final fallback to Yahoo Finance scraper
  try {
    const yahooData = await scrapeYahooAnalystRatings(upperSymbol);

    sources.push({ name: 'Yahoo Finance (Scraper)', status: 'success' });

    return {
      data: yahooData,
      sources,
      primarySource: 'Yahoo Finance',
    };
  } catch (error) {
    sources.push({
      name: 'Yahoo Finance (Scraper)',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Return empty result if all sources fail
  return {
    data: {
      symbol: upperSymbol,
      ratings: [],
      buy_count: 0,
      hold_count: 0,
      sell_count: 0,
      avg_price_target: null,
      high_price_target: null,
      low_price_target: null,
      consensus: 'hold',
    },
    sources,
    primarySource: 'None',
  };
}

// Get comprehensive stock data from Yahoo (fallback for fundamentals)
export async function getYahooFundamentals(symbol: string) {
  const [keyStats, earnings, analyst] = await Promise.all([
    scrapeYahooKeyStats(symbol),
    scrapeYahooEarnings(symbol),
    scrapeYahooAnalystRatings(symbol),
  ]);

  return {
    keyStats,
    earnings,
    analyst,
    source: 'Yahoo Finance (Scraper)',
  };
}
