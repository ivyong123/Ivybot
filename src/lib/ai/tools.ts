import { z } from 'zod';
import { OpenRouterTool } from '@/types/ai';
import {
  GetStockPriceSchema,
  GetOptionsChainSchema,
  GetNewsSentimentSchema,
  GetEarningsCalendarSchema,
  GetAnalystRatingsSchema,
  GetUnusualOptionsFlowSchema,
  GetInsiderTradesSchema,
  GetInstitutionalHoldingsSchema,
  SearchKnowledgeBaseSchema,
  GetHistoricalDataSchema,
  GetForexQuoteSchema,
  GetForexHistoricalSchema,
  GetForexIndicatorSchema,
  GetExchangeRateSchema,
  GetEconomicCalendarSchema,
} from '@/types/ai';

// Define all available tools with their JSON Schema parameters
export const STOCK_TOOLS: OpenRouterTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_stock_price',
      description: 'Get the current stock price, daily change, and volume for a given ticker symbol',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol (e.g., AAPL, MSFT)',
          },
          include_extended: {
            type: 'boolean',
            description: 'Include extended hours data',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_historical_data',
      description: 'Get historical OHLCV (open, high, low, close, volume) data for technical analysis',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol',
          },
          timeframe: {
            type: 'string',
            enum: ['1d', '1w', '1m', '3m', '6m', '1y'],
            description: 'Time period for historical data',
          },
          interval: {
            type: 'string',
            enum: ['1min', '5min', '15min', '1hour', '1day'],
            description: 'Data interval',
            default: '1day',
          },
        },
        required: ['symbol', 'timeframe'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_options_chain',
      description: 'Get the options chain including calls and puts with Greeks, volume, and open interest',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol',
          },
          expiration_date: {
            type: 'string',
            description: 'Filter by specific expiration date (YYYY-MM-DD)',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_news_sentiment',
      description: 'Get recent news articles and sentiment analysis for a stock',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol',
          },
          days: {
            type: 'number',
            description: 'Number of days of news to analyze',
            default: 7,
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_earnings_calendar',
      description: 'Get upcoming and recent earnings dates with estimates and actuals',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_analyst_ratings',
      description: 'Get analyst ratings, price targets, and consensus recommendation',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of ratings to return',
            default: 10,
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_unusual_options_flow',
      description: 'Get unusual options activity and smart money flow data from Unusual Whales (requires subscription)',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_insider_trades',
      description: 'Get recent insider trading activity (SEC Form 4 filings) - shows executive buys/sells which indicate smart money sentiment',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_institutional_holdings',
      description: 'Get institutional holdings data (SEC 13F filings) - shows hedge fund and institutional investor positions',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_trading_knowledge',
      description: 'Search the trading knowledge base for relevant strategies, patterns, and educational content',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query for the knowledge base',
          },
          kb_type: {
            type: 'string',
            enum: ['stock', 'forex'],
            description: 'Which knowledge base to search',
            default: 'stock',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
  },
];

// Forex-specific tools
export const FOREX_TOOLS: OpenRouterTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_forex_quote',
      description: 'Get real-time forex quote with bid/ask prices for a currency pair',
      parameters: {
        type: 'object',
        properties: {
          pair: {
            type: 'string',
            description: 'The forex pair (e.g., EUR/USD, GBP/JPY, USD/CAD)',
          },
        },
        required: ['pair'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_forex_historical',
      description: 'Get historical OHLCV data for a forex pair for technical analysis',
      parameters: {
        type: 'object',
        properties: {
          pair: {
            type: 'string',
            description: 'The forex pair (e.g., EUR/USD)',
          },
          interval: {
            type: 'string',
            enum: ['1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week'],
            description: 'Data interval',
            default: '1day',
          },
          outputSize: {
            type: 'number',
            description: 'Number of data points to return',
            default: 100,
          },
        },
        required: ['pair'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_forex_indicator',
      description: 'Calculate technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR) for a forex pair',
      parameters: {
        type: 'object',
        properties: {
          pair: {
            type: 'string',
            description: 'The forex pair (e.g., EUR/USD)',
          },
          indicator: {
            type: 'string',
            enum: ['sma', 'ema', 'rsi', 'macd', 'bbands', 'atr'],
            description: 'Technical indicator to calculate',
          },
          interval: {
            type: 'string',
            enum: ['1min', '5min', '15min', '30min', '1h', '4h', '1day'],
            description: 'Data interval',
            default: '1day',
          },
          timePeriod: {
            type: 'number',
            description: 'Time period for the indicator (e.g., 14 for RSI)',
            default: 14,
          },
        },
        required: ['pair', 'indicator'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exchange_rate',
      description: 'Get the current exchange rate between two currencies',
      parameters: {
        type: 'object',
        properties: {
          fromCurrency: {
            type: 'string',
            description: 'Source currency code (e.g., USD, EUR, GBP)',
          },
          toCurrency: {
            type: 'string',
            description: 'Target currency code (e.g., JPY, CHF, AUD)',
          },
        },
        required: ['fromCurrency', 'toCurrency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_economic_calendar',
      description: 'Get economic calendar events (Forex Factory) that could impact a currency pair. CRITICAL: Always check this before forex trades to avoid high-impact news.',
      parameters: {
        type: 'object',
        properties: {
          pair: {
            type: 'string',
            description: 'The forex pair (e.g., EUR/USD, GBP/JPY)',
          },
        },
        required: ['pair'],
      },
    },
  },
];

// Combined tools for mixed analysis
export const ALL_TOOLS: OpenRouterTool[] = [...STOCK_TOOLS, ...FOREX_TOOLS];

// Tool name to schema mapping for validation
export const TOOL_SCHEMAS: Record<string, z.ZodObject<z.ZodRawShape>> = {
  // Stock tools
  get_stock_price: GetStockPriceSchema,
  get_historical_data: GetHistoricalDataSchema,
  get_options_chain: GetOptionsChainSchema,
  get_news_sentiment: GetNewsSentimentSchema,
  get_earnings_calendar: GetEarningsCalendarSchema,
  get_analyst_ratings: GetAnalystRatingsSchema,
  get_unusual_options_flow: GetUnusualOptionsFlowSchema,
  get_insider_trades: GetInsiderTradesSchema,
  get_institutional_holdings: GetInstitutionalHoldingsSchema,
  search_trading_knowledge: SearchKnowledgeBaseSchema,
  // Forex tools
  get_forex_quote: GetForexQuoteSchema,
  get_forex_historical: GetForexHistoricalSchema,
  get_forex_indicator: GetForexIndicatorSchema,
  get_exchange_rate: GetExchangeRateSchema,
  get_economic_calendar: GetEconomicCalendarSchema,
};

// Validate tool arguments
export function validateToolArgs<T>(toolName: string, args: unknown): T {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return schema.parse(args) as T;
}
