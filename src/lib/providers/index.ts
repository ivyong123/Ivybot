// Re-export all provider functions
export { getStockQuote, getHistoricalData, getStockNews, getNewsSentiment } from './polygon';
export { getEarningsCalendar, getAnalystRatings } from './benzinga';
export { getOptionsChain, getOptionsExpirations, getFinnhubEarnings, getFinnhubRecommendations } from './finnhub';
export { getUnusualOptionsFlow } from './unusual-whales';
export { getInsiderTrades, getInstitutionalHoldings } from './sec-edgar';

// Yahoo Finance scraper (fallback source)
export {
  scrapeYahooEarnings,
  scrapeYahooAnalystRatings,
  scrapeYahooKeyStats,
  scrapeYahooProfile
} from './yahoo-scraper';

// Financial Modeling Prep (FMP) - free tier alternative
export {
  getFMPEarnings,
  getFMPAnalystRatings,
  getFMPProfile
} from './fmp';

// Unified data with multi-source fallback
export {
  getUnifiedEarnings,
  getUnifiedAnalystRatings,
  getYahooFundamentals
} from './unified-data';

// Twelve Data (Forex & Crypto)
export {
  getForexQuote,
  getExchangeRate,
  getForexHistoricalData,
  getMultipleForexQuotes,
  getForexPairsList,
  getForexIndicator,
  getCryptoQuote
} from './twelvedata';

// Forex Factory Economic Calendar
export {
  getForexCalendar,
  scrapeForexFactoryCalendar,
  getEconomicCalendarAPI
} from './forex-factory';
export type { EconomicEvent, CalendarResult } from './forex-factory';
