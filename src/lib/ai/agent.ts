import { chatCompletion } from './openrouter-client';
import { executeToolCalls } from './executor';
import { STOCK_TOOLS, FOREX_TOOLS, ALL_TOOLS } from './tools';
import { getSystemPrompt, getFinalRecommendationPrompt } from './prompts';
import { performReflection } from './reflection';
import { ChatMessage, AgentState, OpenRouterTool } from '@/types/ai';
import { AnalysisType, TradeRecommendation, ToolCall } from '@/types/analysis';
import { createAdminClient } from '@/lib/supabase/admin';

// Get appropriate tools based on analysis type
function getToolsForAnalysisType(analysisType: AnalysisType): OpenRouterTool[] {
  switch (analysisType) {
    case 'forex':
      // Forex gets forex tools + knowledge base search from stock tools
      return [...FOREX_TOOLS, STOCK_TOOLS.find(t => t.function.name === 'search_trading_knowledge')!];
    case 'stock':
      // Stock analysis uses all stock tools (includes options chain, unusual whales, etc.)
      return STOCK_TOOLS;
    default:
      // For standalone analysis types, use all tools
      return ALL_TOOLS;
  }
}

const MAX_TOOL_CALLS = 15;
const MAX_ITERATIONS = 10;

export interface AgentRunResult {
  recommendation: TradeRecommendation | null;
  toolCalls: ToolCall[];
  initialAnalysis: string | null;
  critique: string | null;
  error: string | null;
}

export interface ProgressCallback {
  (update: {
    phase: string;
    step: string;
    progress: number;
    toolCalls: ToolCall[];
  }): void;
}

// Main agentic loop
export async function runAnalysisAgent(
  symbol: string,
  analysisType: AnalysisType,
  additionalContext: string | undefined,
  onProgress?: ProgressCallback
): Promise<AgentRunResult> {
  const state: AgentState = {
    messages: [],
    tool_calls_made: 0,
    max_tool_calls: MAX_TOOL_CALLS,
    current_phase: 'gathering',
    gathered_data: {},
  };

  const allToolCalls: ToolCall[] = [];

  try {
    // Initialize with system prompt
    const systemPrompt = getSystemPrompt(analysisType);
    state.messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // Add user request with current date context
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split('T')[0];
    const formattedDateTime = currentDate.toISOString();

    let userPrompt = `IMPORTANT: Today's date is ${formattedDate}. The current time is ${formattedDateTime}.

Please analyze ${symbol.toUpperCase()} and provide a comprehensive ${analysisType} trading recommendation.

CRITICAL: All expiration dates, earnings dates, and time-sensitive data MUST be in the future relative to today (${formattedDate}). Do NOT use dates from 2023, 2024, or any past date. Options expirations should typically be 1-12 weeks from today.`;
    if (additionalContext) {
      userPrompt += `\n\nAdditional context from the user: ${additionalContext}`;
    }
    userPrompt += `\n\nStart by gathering relevant data using the available tools, then provide your analysis.`;

    state.messages.push({
      role: 'user',
      content: userPrompt,
    });

    onProgress?.({
      phase: 'gathering',
      step: 'Starting data collection',
      progress: 5,
      toolCalls: allToolCalls,
    });

    // Get the appropriate tools for this analysis type
    const tools = getToolsForAnalysisType(analysisType);
    console.log(`[Agent] Using ${tools.length} tools for ${analysisType} analysis:`, tools.map(t => t.function.name));

    // Agentic loop - let Claude decide what tools to use
    let iteration = 0;
    const FORCE_ANALYSIS_AFTER_TOOLS = 8; // Force analysis after this many tool calls

    while (iteration < MAX_ITERATIONS && state.tool_calls_made < MAX_TOOL_CALLS) {
      iteration++;
      console.log(`[Agent] Iteration ${iteration}/${MAX_ITERATIONS}, tool calls: ${state.tool_calls_made}/${MAX_TOOL_CALLS}`);

      // If we've made enough tool calls, force analysis by removing tools
      const shouldForceAnalysis = state.tool_calls_made >= FORCE_ANALYSIS_AFTER_TOOLS;

      if (shouldForceAnalysis) {
        console.log(`[Agent] Forcing analysis - removing tools after ${state.tool_calls_made} tool calls`);
        state.messages.push({
          role: 'user',
          content: 'You have gathered enough data. STOP calling tools and provide your complete analysis NOW. Do not call any more tools.',
        });
      }

      // Call Claude with tools (using analysis task type for accurate tool use)
      // Remove tools if we need to force analysis
      const response = await chatCompletion(state.messages, {
        tools: shouldForceAnalysis ? undefined : tools,
        taskType: 'analysis',
        maxTokens: 4096,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response from AI');
      }

      const assistantMessage = choice.message;
      state.messages.push(assistantMessage);

      // Check if Claude wants to use tools
      if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
        state.current_phase = 'gathering';

        onProgress?.({
          phase: 'gathering',
          step: `Executing ${assistantMessage.tool_calls.length} tool(s)`,
          progress: Math.min(10 + iteration * 8, 50),
          toolCalls: allToolCalls,
        });

        // Execute the tools
        const { toolResults, toolCalls, errors } = await executeToolCalls(assistantMessage.tool_calls);

        // Track tool calls
        allToolCalls.push(...toolCalls);
        state.tool_calls_made += toolCalls.length;

        // Store gathered data
        for (const tc of toolCalls) {
          if (tc.result && !('error' in (tc.result as Record<string, unknown>))) {
            state.gathered_data[tc.name] = tc.result;
          }
        }

        // Add tool results to messages
        for (const result of toolResults) {
          state.messages.push({
            role: 'tool',
            content: result.content,
            tool_call_id: result.tool_call_id,
          });
        }

        onProgress?.({
          phase: 'gathering',
          step: `Processed ${toolCalls.length} tool results`,
          progress: Math.min(15 + iteration * 8, 55),
          toolCalls: allToolCalls,
        });

        continue;
      }

      // Claude has finished gathering data and provided analysis
      // If not tool_calls, treat as completion (stop, length, content_filter)
      if (choice.finish_reason !== 'tool_calls' && assistantMessage.content) {
        state.current_phase = 'analyzing';

        onProgress?.({
          phase: 'analyzing',
          step: 'Initial analysis complete',
          progress: 60,
          toolCalls: allToolCalls,
        });

        // Store initial analysis
        const initialAnalysis = assistantMessage.content;

        // Perform self-reflection
        onProgress?.({
          phase: 'reflecting',
          step: 'Critiquing analysis',
          progress: 70,
          toolCalls: allToolCalls,
        });

        const reflection = await performReflection(
          initialAnalysis,
          state.gathered_data,
          2 // Max 2 refinement iterations
        );

        onProgress?.({
          phase: 'reflecting',
          step: 'Reflection complete',
          progress: 80,
          toolCalls: allToolCalls,
        });

        // Get final structured recommendation
        state.current_phase = 'finalizing';

        onProgress?.({
          phase: 'finalizing',
          step: 'Generating final recommendation',
          progress: 85,
          toolCalls: allToolCalls,
        });

        const finalAnalysis = reflection.refined_analysis || initialAnalysis;

        // Ask for structured output
        state.messages.push({
          role: 'user',
          content: `${getFinalRecommendationPrompt()}\n\nBased on your analysis:\n${finalAnalysis}`,
        });

        const finalResponse = await chatCompletion(state.messages, {
          taskType: 'recommendation',
          maxTokens: 4096,
        });

        const finalContent = finalResponse.choices[0]?.message?.content;
        console.log('[Agent] Final response finish_reason:', finalResponse.choices[0]?.finish_reason);
        console.log('[Agent] Final content length:', finalContent?.length);
        console.log('[Agent] Final content preview:', finalContent?.slice(0, 500));

        if (!finalContent) {
          throw new Error('No final recommendation generated');
        }

        // Parse the recommendation
        const recommendation = parseRecommendation(finalContent, symbol, analysisType);
        console.log('[Agent] Parsed recommendation:', recommendation ? 'SUCCESS' : 'NULL');
        console.log('[Agent] Recommendation symbol:', recommendation?.symbol);
        console.log('[Agent] Recommendation type:', recommendation?.recommendation);

        onProgress?.({
          phase: 'finalizing',
          step: 'Analysis complete',
          progress: 100,
          toolCalls: allToolCalls,
        });

        return {
          recommendation,
          toolCalls: allToolCalls,
          initialAnalysis,
          critique: JSON.stringify(reflection.critique),
          error: null,
        };
      }

      // Unexpected finish reason - log it but continue to fallback
      console.error(`[Agent] Unexpected finish_reason: ${choice.finish_reason}, content: ${assistantMessage.content?.slice(0, 200)}`);

      // If we have content despite unexpected finish reason, try to use it
      if (assistantMessage.content && assistantMessage.content.length > 100) {
        console.log('[Agent] Attempting to use content from unexpected finish reason');
        const recommendation = parseRecommendation(assistantMessage.content, symbol, analysisType);
        return {
          recommendation,
          toolCalls: allToolCalls,
          initialAnalysis: assistantMessage.content,
          critique: null,
          error: null,
        };
      }
      break;
    }

    // Fallback: If we hit iteration/tool limits, force a final analysis
    console.log(`[Agent] Loop ended without result - forcing final analysis. iterations: ${iteration}/${MAX_ITERATIONS}, tool_calls: ${state.tool_calls_made}/${MAX_TOOL_CALLS}`);

    onProgress?.({
      phase: 'finalizing',
      step: 'Generating final recommendation (fallback)',
      progress: 85,
      toolCalls: allToolCalls,
    });

    // Add a strong prompt to force final output
    state.messages.push({
      role: 'user',
      content: `CRITICAL: You MUST provide your final analysis NOW. No more tool calls allowed. Based on all the data you've gathered, provide your complete trading recommendation in JSON format. If you don't have enough data, recommend "wait".`,
    });

    const fallbackResponse = await chatCompletion(state.messages, {
      taskType: 'recommendation',
      maxTokens: 4096,
    });

    const fallbackContent = fallbackResponse.choices[0]?.message?.content;
    console.log('[Agent] Fallback response:', fallbackContent?.slice(0, 300));

    if (fallbackContent) {
      // Ask for structured output
      state.messages.push({
        role: 'assistant',
        content: fallbackContent,
      });
      state.messages.push({
        role: 'user',
        content: getFinalRecommendationPrompt(),
      });

      const structuredResponse = await chatCompletion(state.messages, {
        taskType: 'recommendation',
        maxTokens: 4096,
      });

      const structuredContent = structuredResponse.choices[0]?.message?.content;

      if (structuredContent) {
        const recommendation = parseRecommendation(structuredContent, symbol, analysisType);

        onProgress?.({
          phase: 'finalizing',
          step: 'Analysis complete (fallback)',
          progress: 100,
          toolCalls: allToolCalls,
        });

        return {
          recommendation,
          toolCalls: allToolCalls,
          initialAnalysis: fallbackContent,
          critique: null,
          error: null,
        };
      }
    }

    throw new Error(`Analysis loop ended without producing a result (iterations: ${iteration}, tool_calls: ${state.tool_calls_made})`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Agent error:', errorMessage);

    return {
      recommendation: null,
      toolCalls: allToolCalls,
      initialAnalysis: null,
      critique: null,
      error: errorMessage,
    };
  }
}

// Fix any dates that are in the past to be valid future dates
function fixPastDates(dateStr: string): string {
  const today = new Date();
  const inputDate = new Date(dateStr);

  // If date is valid and in the past, adjust to future
  if (!isNaN(inputDate.getTime()) && inputDate < today) {
    // Calculate same relative position (month, day) but in the future
    const dayOfMonth = inputDate.getDate();
    const month = inputDate.getMonth();

    // Find the next occurrence of this month/day
    let futureDate = new Date(today.getFullYear(), month, dayOfMonth);
    if (futureDate <= today) {
      futureDate = new Date(today.getFullYear() + 1, month, dayOfMonth);
    }

    // For options, round to nearest Friday (typical expiration day)
    const dayOfWeek = futureDate.getDay();
    if (dayOfWeek !== 5) { // If not Friday
      const daysToFriday = (5 - dayOfWeek + 7) % 7;
      futureDate.setDate(futureDate.getDate() + (daysToFriday === 0 ? 7 : daysToFriday));
    }

    return futureDate.toISOString().split('T')[0];
  }

  return dateStr;
}

// Fix options strategy dates
function fixOptionsStrategyDates(strategy: TradeRecommendation['options_strategy']): TradeRecommendation['options_strategy'] {
  if (!strategy || !strategy.legs) return strategy;

  return {
    ...strategy,
    legs: strategy.legs.map(leg => ({
      ...leg,
      expiration: leg.expiration ? fixPastDates(leg.expiration) : leg.expiration,
    })),
  };
}

// Validate risk-to-reward ratio and entry quality
function validateTradeQuality(
  recommendation: string,
  entryPrice: number | null,
  stopLoss: number | null,
  priceTarget: number | null,
  confidence: number,
  analysisType: AnalysisType
): { isValid: boolean; reason: string } {
  // Skip validation for wait/hold recommendations
  if (recommendation === 'wait' || recommendation === 'hold') {
    return { isValid: true, reason: 'Wait/hold recommendation' };
  }

  // Check confidence threshold
  if (confidence < 60) {
    return { isValid: false, reason: `Low confidence (${confidence}%) - should be wait` };
  }

  // For stock/options, validate R:R
  if (analysisType === 'stock' && entryPrice && stopLoss && priceTarget) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(priceTarget - entryPrice);
    const riskRewardRatio = risk > 0 ? reward / risk : 0;

    console.log(`[Agent] R:R Validation - Entry: ${entryPrice}, SL: ${stopLoss}, Target: ${priceTarget}`);
    console.log(`[Agent] R:R Validation - Risk: ${risk.toFixed(2)}, Reward: ${reward.toFixed(2)}, Ratio: ${riskRewardRatio.toFixed(2)}`);

    if (riskRewardRatio < 2) {
      return {
        isValid: false,
        reason: `R:R ratio ${riskRewardRatio.toFixed(1)}:1 is below minimum 2:1 - should be wait`
      };
    }
  }

  return { isValid: true, reason: 'Trade meets quality requirements' };
}

// Parse Claude's JSON recommendation
function parseRecommendation(
  content: string,
  symbol: string,
  analysisType: AnalysisType
): TradeRecommendation {
  try {
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log('[Agent] Parsed recommendation keys:', Object.keys(parsed));

    // Fix any past dates in options strategy
    const fixedOptionsStrategy = fixOptionsStrategyDates(parsed.options_strategy);

    // Parse forex_setup if present (handle both old and new format)
    let forexSetup = undefined;
    if (parsed.forex_setup) {
      // Handle the new nested format from the prompt
      forexSetup = parseForexSetup(parsed.forex_setup, symbol);

      // Validate forex R:R - TP2 should be at least 2:1
      if (forexSetup && forexSetup.trade) {
        const slPips = forexSetup.trade.stopLossPips;
        const tp2Pips = forexSetup.trade.takeProfit2Pips;
        const tp2RR = slPips > 0 ? tp2Pips / slPips : 0;

        console.log(`[Agent] Forex R:R - SL: ${slPips} pips, TP2: ${tp2Pips} pips, R:R: ${tp2RR.toFixed(2)}`);

        if (tp2RR < 2 && parsed.recommendation !== 'wait' && parsed.recommendation !== 'hold') {
          console.log('[Agent] Forex R:R below 2:1 - converting to wait');
          parsed.recommendation = 'wait';
          parsed.reasoning = `Original setup had R:R of ${tp2RR.toFixed(1)}:1 which is below minimum 2:1. Wait for better entry. Original analysis: ${parsed.reasoning}`;
        }
      }
    }

    // Validate trade quality for stocks
    const validation = validateTradeQuality(
      parsed.recommendation || 'hold',
      parsed.entry_price,
      parsed.stop_loss,
      parsed.price_target,
      parsed.confidence || 50,
      analysisType
    );

    // If validation fails, convert to "wait" recommendation
    let finalRecommendation = parsed.recommendation || 'hold';
    let finalReasoning = parsed.reasoning || 'Analysis complete';

    if (!validation.isValid) {
      console.log(`[Agent] Trade validation failed: ${validation.reason}`);
      finalRecommendation = 'wait';
      finalReasoning = `${validation.reason}. Original analysis: ${parsed.reasoning || 'See analysis above'}`;
    }

    // Extract current price from various possible sources
    let currentPrice = parsed.current_price || parsed.currentPrice || null;
    // Fallback: try to get from forex_setup or stock_result
    if (!currentPrice && forexSetup?.currentPrice) {
      currentPrice = forexSetup.currentPrice;
    }
    if (!currentPrice && parsed.stock_result?.currentPrice) {
      currentPrice = parsed.stock_result.currentPrice;
    }

    // Validate and return
    return {
      symbol: parsed.symbol || symbol.toUpperCase(),
      analysis_type: parsed.analysis_type || analysisType,
      recommendation: finalRecommendation,
      confidence: parsed.confidence || 50,
      current_price: currentPrice,
      price_target: parsed.price_target || null,
      stop_loss: parsed.stop_loss || null,
      entry_price: parsed.entry_price || null,
      timeframe: parsed.timeframe || 'Unknown',
      reasoning: finalReasoning,
      key_factors: parsed.key_factors || [],
      risks: parsed.risks || [],
      options_strategy: fixedOptionsStrategy || undefined,
      stock_result: parsed.stock_result || undefined,
      forex_setup: forexSetup,
      data_sources: parsed.data_sources || [],
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to parse recommendation:', error);
    console.error('Content preview:', content.slice(0, 500));

    // Return a basic recommendation if parsing fails
    return {
      symbol: symbol.toUpperCase(),
      analysis_type: analysisType,
      recommendation: 'hold',
      confidence: 30,
      current_price: null,
      price_target: null,
      stop_loss: null,
      entry_price: null,
      timeframe: 'Unknown',
      reasoning: content.slice(0, 500),
      key_factors: [],
      risks: ['Analysis parsing failed - review manually'],
      data_sources: [],
      generated_at: new Date().toISOString(),
    };
  }
}

// Helper to safely get nested property
function getNestedValue(obj: Record<string, unknown> | undefined, key: string): unknown {
  if (!obj) return undefined;
  const nested = obj[key] as Record<string, unknown> | undefined;
  return nested?.price ?? nested;
}

// Parse and normalize forex setup from AI response
function parseForexSetup(raw: Record<string, unknown>, symbol: string): TradeRecommendation['forex_setup'] {
  // Handle the new nested format from the comprehensive prompt
  const trade = raw.trade as Record<string, unknown> | undefined;
  const levels = raw.levels as Record<string, unknown> | undefined;
  const indicators = raw.indicators as Record<string, unknown> | undefined;
  const timing = raw.timing as Record<string, unknown> | undefined;
  const newsWarning = raw.news_warning as Record<string, unknown> | undefined;

  // Calculate pip values if we have entry and SL
  const entryPrice = Number(trade?.entry_price || raw.entry_price || 0);
  const stopLossPrice = Number(getNestedValue(levels, 'stop_loss') || trade?.stop_loss || raw.stop_loss_price || 0);
  const tp1Price = Number(getNestedValue(levels, 'take_profit_1') || trade?.take_profit_1 || raw.take_profit_price || 0);
  const tp2Price = Number(getNestedValue(levels, 'take_profit_2') || trade?.take_profit_2 || 0);
  const tp3Price = Number(getNestedValue(levels, 'take_profit_3') || trade?.take_profit_3 || 0);

  // Determine pip multiplier (JPY pairs use 100, others use 10000)
  const isJPY = symbol.toUpperCase().includes('JPY');
  const pipMultiplier = isJPY ? 100 : 10000;

  const direction = (trade?.direction || raw.direction || 'long') as string;
  const isLong = direction.toLowerCase() === 'long' || direction === 'BUY';

  // Calculate pip distances
  const slPips = Math.abs((entryPrice - stopLossPrice) * pipMultiplier);
  const tp1Pips = Math.abs((tp1Price - entryPrice) * pipMultiplier);
  const tp2Pips = tp2Price ? Math.abs((tp2Price - entryPrice) * pipMultiplier) : tp1Pips * 2;
  const tp3Pips = tp3Price ? Math.abs((tp3Price - entryPrice) * pipMultiplier) : tp1Pips * 3;

  return {
    pair: String(trade?.pair || raw.pair || symbol),
    currentPrice: entryPrice,
    direction: isLong ? 'BULLISH' : 'BEARISH',

    trade: {
      action: isLong ? 'BUY' : 'SELL',
      orderType: (trade?.order_type || 'LIMIT') as 'LIMIT' | 'MARKET',
      entryPrice,
      stopLoss: stopLossPrice,
      takeProfit1: tp1Price || entryPrice + (isLong ? tp1Pips : -tp1Pips) / pipMultiplier,
      takeProfit2: tp2Price || entryPrice + (isLong ? tp2Pips : -tp2Pips) / pipMultiplier,
      takeProfit3: tp3Price || entryPrice + (isLong ? tp3Pips : -tp3Pips) / pipMultiplier,
      stopLossPips: Math.round(slPips),
      takeProfit1Pips: Math.round(tp1Pips),
      takeProfit2Pips: Math.round(tp2Pips),
      takeProfit3Pips: Math.round(tp3Pips),
      riskRewardRatio: slPips > 0 ? `1:${(tp1Pips / slPips).toFixed(1)}` : '1:2',
    },

    riskManagement: {
      riskPercent: 1,
      suggestedLotSize: 0.1,
      maxRiskDollars: 100,
      pipValue: 10,
      calculation: String(trade?.position_size_suggestion || raw.position_size_suggestion || 'Risk 1% of account'),
    },

    levels: {
      support1: Number((levels?.key_support as number[])?.[0] || 0),
      support2: Number((levels?.key_support as number[])?.[1] || 0),
      support3: 0,
      resistance1: Number((levels?.key_resistance as number[])?.[0] || 0),
      resistance2: Number((levels?.key_resistance as number[])?.[1] || 0),
      resistance3: 0,
      dailyPivot: entryPrice,
      atr: slPips,
    },

    indicators: {
      rsi: {
        value: Number((indicators?.rsi as number) || 50),
        interpretation: String((indicators?.trend as string) || 'Neutral'),
      },
      macd: {
        value: 0,
        signal: 0,
        histogram: 0,
        interpretation: String((indicators?.macd as string) || 'Neutral'),
      },
      ema: {
        ema20: entryPrice,
        ema50: entryPrice,
        ema200: entryPrice,
        interpretation: String((indicators?.moving_averages as string) || 'Mixed'),
      },
      stochastic: {
        k: 50,
        d: 50,
        interpretation: 'Neutral',
      },
    },

    analysis: {
      trend: String((indicators?.trend as string) || 'Neutral'),
      technicalSetup: 'See analysis above',
      economicCalendar: newsWarning ? 'News events present' : 'Clear',
      sessionAnalysis: String((timing?.session_explanation as string) || ''),
      riskFactors: (raw.risks as string[]) || [],
    },

    confidence: {
      score: 70,
      level: 'MODERATE',
      explanation: 'Based on technical and fundamental analysis',
    },

    execution: {
      entryInstructions: `Place ${isLong ? 'BUY' : 'SELL'} order at ${entryPrice}`,
      profitTargets: `TP1: ${tp1Pips} pips, TP2: ${tp2Pips} pips, TP3: ${tp3Pips} pips`,
      stopLossRules: `Set SL at ${stopLossPrice} (${slPips} pips)`,
      managementRules: [
        'Move SL to breakeven after TP1 is hit',
        'Close 50% at TP1, 30% at TP2, 20% at TP3',
      ],
    },

    timing: {
      currentSession: String((timing?.best_session as string) || 'London'),
      optimalEntry: String((timing?.best_session as string) || 'During London session'),
      newsWarnings: (newsWarning?.high_impact_events as string[]) || [],
      expiryTime: String((timing?.valid_until as string) || '24 hours'),
    },
  };
}

// Update job status in database
export async function updateJobStatus(
  jobId: string,
  updates: {
    status?: string;
    progress?: number;
    current_step?: string;
    tools_called?: ToolCall[];
    initial_analysis?: string;
    critique?: string;
    final_result?: TradeRecommendation;
    error?: string;
  }
): Promise<void> {
  const supabase = createAdminClient();

  console.log('[Agent] Updating job:', jobId, 'status:', updates.status, 'has_final_result:', !!updates.final_result);
  if (updates.final_result) {
    console.log('[Agent] Final result symbol:', updates.final_result.symbol);
    console.log('[Agent] Final result recommendation:', updates.final_result.recommendation);
    console.log('[Agent] Final result has forex_setup:', !!updates.final_result.forex_setup);
    console.log('[Agent] Final result has options_strategy:', !!updates.final_result.options_strategy);
  }

  const { error } = await supabase
    .from('trading_analysis_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to update job status:', error);
    console.error('Error details:', JSON.stringify(error));
  } else {
    console.log('[Agent] Job update successful');
  }
}
