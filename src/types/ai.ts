import { z } from 'zod';

// Tool Definition Types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
}

// OpenRouter / OpenAI Compatible Types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCallRequest[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: OpenRouterTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

// Agent State
export interface AgentState {
  messages: ChatMessage[];
  tool_calls_made: number;
  max_tool_calls: number;
  current_phase: 'gathering' | 'analyzing' | 'reflecting' | 'finalizing';
  gathered_data: Record<string, unknown>;
}

// Self-Reflection Types
export interface AnalysisCritique {
  strengths: string[];
  weaknesses: string[];
  missing_data: string[];
  confidence_assessment: number;
  recommendations: string[];
  should_refine: boolean;
}

export interface ReflectionResult {
  initial_analysis: string;
  critique: AnalysisCritique;
  refined_analysis: string | null;
  iterations: number;
}

// RAG Types
export interface DocumentChunk {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface RAGContext {
  query: string;
  chunks: DocumentChunk[];
  total_tokens: number;
}

// Embedding Types
export interface EmbeddingRequest {
  input: string | string[];
  model: string;
}

export interface EmbeddingResponse {
  data: {
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Tool Parameter Schemas
export const GetStockPriceSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol (e.g., AAPL, MSFT)'),
  include_extended: z.boolean().optional().describe('Include extended hours data'),
});

export const GetOptionsChainSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol'),
  expiration_date: z.string().optional().describe('Filter by specific expiration date (YYYY-MM-DD)'),
});

export const GetNewsSentimentSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol'),
  days: z.number().optional().default(7).describe('Number of days of news to analyze'),
});

export const GetEarningsCalendarSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol'),
});

export const GetAnalystRatingsSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol'),
  limit: z.number().optional().default(10).describe('Maximum number of ratings to return'),
});

export const GetUnusualOptionsFlowSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol'),
});

export const SearchKnowledgeBaseSchema = z.object({
  query: z.string().describe('The search query for the knowledge base'),
  kb_type: z.enum(['stock', 'forex']).optional().default('stock').describe('Which knowledge base to search'),
  limit: z.number().optional().default(5).describe('Maximum number of results'),
});

export const GetHistoricalDataSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol'),
  timeframe: z.enum(['1d', '1w', '1m', '3m', '6m', '1y']).describe('Time period for historical data'),
  interval: z.enum(['1min', '5min', '15min', '1hour', '1day']).optional().default('1day').describe('Data interval'),
});

export const GetInsiderTradesSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol'),
});

export const GetInstitutionalHoldingsSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol'),
});

// Forex Tool Schemas
export const GetForexQuoteSchema = z.object({
  pair: z.string().describe('The forex pair (e.g., EUR/USD, GBP/JPY)'),
});

export const GetForexHistoricalSchema = z.object({
  pair: z.string().describe('The forex pair (e.g., EUR/USD)'),
  interval: z.enum(['1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week']).optional().default('1day').describe('Data interval'),
  outputSize: z.number().optional().default(100).describe('Number of data points to return'),
});

export const GetForexIndicatorSchema = z.object({
  pair: z.string().describe('The forex pair (e.g., EUR/USD)'),
  indicator: z.enum(['sma', 'ema', 'rsi', 'macd', 'bbands', 'atr']).describe('Technical indicator to calculate'),
  interval: z.enum(['1min', '5min', '15min', '30min', '1h', '4h', '1day']).optional().default('1day').describe('Data interval'),
  timePeriod: z.number().optional().default(14).describe('Time period for the indicator'),
});

export const GetExchangeRateSchema = z.object({
  fromCurrency: z.string().describe('Source currency code (e.g., USD)'),
  toCurrency: z.string().describe('Target currency code (e.g., EUR)'),
});

// Economic Calendar Schema
export const GetEconomicCalendarSchema = z.object({
  pair: z.string().describe('The forex pair to get calendar events for (e.g., EUR/USD)'),
});

export type GetStockPriceParams = z.infer<typeof GetStockPriceSchema>;
export type GetEconomicCalendarParams = z.infer<typeof GetEconomicCalendarSchema>;
export type GetOptionsChainParams = z.infer<typeof GetOptionsChainSchema>;
export type GetNewsSentimentParams = z.infer<typeof GetNewsSentimentSchema>;
export type GetEarningsCalendarParams = z.infer<typeof GetEarningsCalendarSchema>;
export type GetAnalystRatingsParams = z.infer<typeof GetAnalystRatingsSchema>;
export type GetUnusualOptionsFlowParams = z.infer<typeof GetUnusualOptionsFlowSchema>;
export type SearchKnowledgeBaseParams = z.infer<typeof SearchKnowledgeBaseSchema>;
export type GetHistoricalDataParams = z.infer<typeof GetHistoricalDataSchema>;
export type GetInsiderTradesParams = z.infer<typeof GetInsiderTradesSchema>;
export type GetInstitutionalHoldingsParams = z.infer<typeof GetInstitutionalHoldingsSchema>;
export type GetForexQuoteParams = z.infer<typeof GetForexQuoteSchema>;
export type GetForexHistoricalParams = z.infer<typeof GetForexHistoricalSchema>;
export type GetForexIndicatorParams = z.infer<typeof GetForexIndicatorSchema>;
export type GetExchangeRateParams = z.infer<typeof GetExchangeRateSchema>;
