import { ToolCallRequest, ToolResult } from '@/types/ai';
import { ToolCall } from '@/types/analysis';
import { validateToolArgs, TOOL_SCHEMAS } from './tools';
import {
  getStockQuote,
  getHistoricalData,
  getNewsSentiment,
  getOptionsChain,
  getUnifiedEarnings,
  getUnifiedAnalystRatings,
  getUnusualOptionsFlow,
  getInsiderTrades,
  getInstitutionalHoldings,
  // Forex providers
  getForexQuote,
  getForexHistoricalData,
  getForexIndicator,
  getExchangeRate,
  getForexCalendar,
} from '@/lib/providers';
import { searchKnowledgeBase } from '@/lib/rag';
import {
  GetStockPriceParams,
  GetHistoricalDataParams,
  GetNewsSentimentParams,
  GetOptionsChainParams,
  GetEarningsCalendarParams,
  GetAnalystRatingsParams,
  GetUnusualOptionsFlowParams,
  GetInsiderTradesParams,
  GetInstitutionalHoldingsParams,
  SearchKnowledgeBaseParams,
  GetForexQuoteParams,
  GetForexHistoricalParams,
  GetForexIndicatorParams,
  GetExchangeRateParams,
  GetEconomicCalendarParams,
} from '@/types/ai';

export interface ToolExecutionResult {
  toolResults: ToolResult[];
  toolCalls: ToolCall[];
  errors: string[];
}

// Timeout wrapper for tool execution
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Execute a single tool with timeout
async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ result: unknown; error?: string }> {
  try {
    switch (toolName) {
      case 'get_stock_price': {
        const params = validateToolArgs<GetStockPriceParams>(toolName, args);
        const result = await getStockQuote(params.symbol);
        return { result };
      }

      case 'get_historical_data': {
        const params = validateToolArgs<GetHistoricalDataParams>(toolName, args);
        const result = await getHistoricalData(
          params.symbol,
          params.timeframe,
          params.interval
        );
        return { result };
      }

      case 'get_options_chain': {
        const params = validateToolArgs<GetOptionsChainParams>(toolName, args);
        const result = await getOptionsChain(params.symbol, params.expiration_date);
        return { result };
      }

      case 'get_news_sentiment': {
        const params = validateToolArgs<GetNewsSentimentParams>(toolName, args);
        const result = await getNewsSentiment(params.symbol, params.days);
        return { result };
      }

      case 'get_earnings_calendar': {
        const params = validateToolArgs<GetEarningsCalendarParams>(toolName, args);
        const unified = await getUnifiedEarnings(params.symbol);
        // Return data with source info for transparency
        return {
          result: {
            ...unified.data,
            _meta: {
              source: unified.primarySource,
              sources_tried: unified.sources,
            },
          },
        };
      }

      case 'get_analyst_ratings': {
        const params = validateToolArgs<GetAnalystRatingsParams>(toolName, args);
        const unified = await getUnifiedAnalystRatings(params.symbol);
        // Return data with source info for transparency
        return {
          result: {
            ...unified.data,
            _meta: {
              source: unified.primarySource,
              sources_tried: unified.sources,
            },
          },
        };
      }

      case 'get_unusual_options_flow': {
        const params = validateToolArgs<GetUnusualOptionsFlowParams>(toolName, args);
        console.log(`[Unusual Whales] Fetching options flow for ${params.symbol}...`);
        const result = await getUnusualOptionsFlow(params.symbol);
        console.log(`[Unusual Whales] Got ${result.flows?.length || 0} flows for ${params.symbol}, sentiment: ${result.overall_sentiment}`);
        return { result };
      }

      case 'get_insider_trades': {
        const params = validateToolArgs<GetInsiderTradesParams>(toolName, args);
        const result = await getInsiderTrades(params.symbol);
        return { result };
      }

      case 'get_institutional_holdings': {
        const params = validateToolArgs<GetInstitutionalHoldingsParams>(toolName, args);
        const result = await getInstitutionalHoldings(params.symbol);
        return { result };
      }

      case 'search_trading_knowledge': {
        const params = validateToolArgs<SearchKnowledgeBaseParams>(toolName, args);
        const result = await searchKnowledgeBase(params.query, params.kb_type, params.limit);
        return { result };
      }

      // Forex tools
      case 'get_forex_quote': {
        const params = validateToolArgs<GetForexQuoteParams>(toolName, args);
        const result = await getForexQuote(params.pair);
        return { result };
      }

      case 'get_forex_historical': {
        const params = validateToolArgs<GetForexHistoricalParams>(toolName, args);
        const result = await getForexHistoricalData(
          params.pair,
          params.interval as '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day' | '1week',
          params.outputSize
        );
        return { result };
      }

      case 'get_forex_indicator': {
        const params = validateToolArgs<GetForexIndicatorParams>(toolName, args);
        const result = await getForexIndicator(
          params.pair,
          params.indicator,
          params.interval as '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day',
          params.timePeriod
        );
        return { result };
      }

      case 'get_exchange_rate': {
        const params = validateToolArgs<GetExchangeRateParams>(toolName, args);
        const result = await getExchangeRate(params.fromCurrency, params.toCurrency);
        return { result };
      }

      case 'get_economic_calendar': {
        const params = validateToolArgs<GetEconomicCalendarParams>(toolName, args);
        const result = await getForexCalendar(params.pair);
        return { result };
      }

      default:
        return { result: null, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Tool execution error (${toolName}):`, errorMessage);
    return { result: null, error: errorMessage };
  }
}

// Execute multiple tool calls from Claude's response
export async function executeToolCalls(
  toolCalls: ToolCallRequest[]
): Promise<ToolExecutionResult> {
  const toolResults: ToolResult[] = [];
  const executedToolCalls: ToolCall[] = [];
  const errors: string[] = [];

  // Execute tools in parallel for efficiency
  const executions = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const startTime = Date.now();
      let args: Record<string, unknown>;

      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        return {
          toolCall,
          result: null,
          error: `Invalid JSON arguments: ${toolCall.function.arguments}`,
          duration: 0,
        };
      }

      // Execute tool with 15 second timeout to prevent hanging
      const TOOL_TIMEOUT_MS = 15000;
      try {
        const { result, error } = await withTimeout(
          executeTool(toolCall.function.name, args),
          TOOL_TIMEOUT_MS,
          toolCall.function.name
        );
        const duration = Date.now() - startTime;

        return {
          toolCall,
          args,
          result,
          error,
          duration,
        };
      } catch (timeoutError) {
        const duration = Date.now() - startTime;
        console.error(`[Executor] Tool ${toolCall.function.name} timed out after ${duration}ms`);
        return {
          toolCall,
          args,
          result: null,
          error: `Tool timed out after ${TOOL_TIMEOUT_MS}ms`,
          duration,
        };
      }
    })
  );

  // Process results
  for (const execution of executions) {
    const { toolCall, args, result, error, duration } = execution;

    // Record the tool call
    executedToolCalls.push({
      name: toolCall.function.name,
      args: args || {},
      result: error ? { error } : result,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });

    // Create tool result for Claude
    if (error) {
      errors.push(`${toolCall.function.name}: ${error}`);
      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        content: JSON.stringify({ error }),
      });
    } else {
      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        content: JSON.stringify(result),
      });
    }
  }

  return { toolResults, toolCalls: executedToolCalls, errors };
}
