// OHLCV Data
export interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  transactions?: number;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  avg_volume: number;
  market_cap: number | null;
  high_52w: number | null;
  low_52w: number | null;
  timestamp: number;
}

// Options Data
export interface OptionsChain {
  symbol: string;
  underlying_price: number;
  expiration_dates: string[];
  calls: OptionContract[];
  puts: OptionContract[];
  timestamp: number;
}

export interface OptionContract {
  symbol: string; // Option symbol (e.g., AAPL230120C00150000)
  underlying: string;
  expiration: string;
  strike: number;
  option_type: 'call' | 'put';
  bid: number;
  ask: number;
  last: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  in_the_money: boolean;
}

// News & Sentiment
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  symbols: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  sentiment_score: number | null; // -1 to 1
}

export interface NewsSentiment {
  symbol: string;
  articles: NewsArticle[];
  overall_sentiment: 'bullish' | 'bearish' | 'neutral';
  sentiment_score: number; // -1 to 1
  article_count: number;
  period: string;
}

// Earnings & Fundamentals
export interface EarningsEvent {
  symbol: string;
  report_date: string;
  fiscal_quarter: string;
  fiscal_year: number;
  eps_estimate: number | null;
  eps_actual: number | null;
  eps_surprise: number | null;
  revenue_estimate: number | null;
  revenue_actual: number | null;
  revenue_surprise: number | null;
  time: 'before_market' | 'after_market' | 'during_market' | null;
}

export interface EarningsCalendar {
  symbol: string;
  upcoming: EarningsEvent[];
  recent: EarningsEvent[];
}

// Analyst Ratings
export interface AnalystRating {
  symbol: string;
  analyst: string;
  firm: string;
  rating: string;
  rating_prior: string | null;
  price_target: number | null;
  price_target_prior: number | null;
  action: 'upgrade' | 'downgrade' | 'maintain' | 'initiate';
  date: string;
}

export interface AnalystConsensus {
  symbol: string;
  ratings: AnalystRating[];
  buy_count: number;
  hold_count: number;
  sell_count: number;
  avg_price_target: number | null;
  high_price_target: number | null;
  low_price_target: number | null;
  consensus: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
}

// Unusual Options Activity
export interface UnusualOptionsFlow {
  symbol: string;
  timestamp: string;
  option_symbol: string;
  expiration: string;
  strike: number;
  option_type: 'call' | 'put';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  volume: number;
  open_interest: number;
  volume_oi_ratio: number;
  premium: number;
  underlying_price: number;
  trade_type: 'sweep' | 'block' | 'split' | 'multi_leg';
}

export interface UnusualFlowSummary {
  symbol: string;
  flows: UnusualOptionsFlow[];
  total_call_premium: number;
  total_put_premium: number;
  call_put_ratio: number;
  overall_sentiment: 'bullish' | 'bearish' | 'neutral';
  notable_strikes: number[];
}

// Forex Data
export interface ForexQuote {
  pair: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
}

export interface ForexOHLCV extends OHLCVBar {
  pair: string;
}

// Insider Trading (SEC Form 4)
export interface InsiderTrade {
  symbol: string;
  insider_name: string;
  insider_title: string;
  transaction_date: string;
  transaction_type: 'buy' | 'sell' | 'other';
  shares: number;
  price: number;
  value: number;
  shares_owned_after: number;
  filing_url?: string;
}

// Institutional Holdings (SEC 13F)
export interface InstitutionalHolding {
  symbol: string;
  institution_name: string;
  shares: number;
  value: number;
  percent_of_portfolio: number;
  percent_of_shares_outstanding: number;
  change_in_shares: number;
  change_percent: number;
  filing_date: string;
  quarter: string;
}

// Provider Response Types
export interface PolygonResponse<T> {
  results: T[];
  status: string;
  request_id: string;
  count?: number;
  next_url?: string;
}

export interface FinnhubResponse<T> {
  data: T;
}
