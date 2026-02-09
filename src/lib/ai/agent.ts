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
      userPrompt += `

## USER CONTEXT (IMPORTANT - 30-40% WEIGHT)
The user has provided specific context that MUST influence your analysis:
"${additionalContext}"

You MUST:
1. Directly address this context in your analysis
2. Weight this context at 30-40% of your recommendation decision
3. Tailor your strategy, timeframe, and risk approach based on what the user specified
4. Explicitly mention how you incorporated their context in your reasoning

Examples of how to apply user context:
- "Looking for scalp trade" → Focus on shorter timeframes, tighter SL/TP, quicker entries
- "Swing trade opportunity" → Focus on H4/D1 timeframes, wider SL/TP, key levels
- "Concerned about earnings" → Address earnings risk, consider IV, suggest hedging
- "Already long, looking for exit" → Focus on resistance levels, trailing stops, profit targets`;
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

        // Ask for structured output - use higher token limit for forex JSON
        state.messages.push({
          role: 'user',
          content: `${getFinalRecommendationPrompt()}\n\nIMPORTANT: Respond with ONLY the JSON object. No markdown, no explanation, no code fences. Start your response with { and end with }.\n\nBased on your analysis:\n${finalAnalysis}`,
        });

        const finalResponse = await chatCompletion(state.messages, {
          taskType: 'recommendation',
          maxTokens: 8192,
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
      content: `CRITICAL: You MUST provide your final analysis NOW. No more tool calls allowed. Based on all the data you've gathered, provide your complete trading recommendation in JSON format. If you don't have enough data, recommend "wait". Respond with ONLY the JSON object, no markdown.`,
    });

    const fallbackResponse = await chatCompletion(state.messages, {
      taskType: 'recommendation',
      maxTokens: 8192,
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
        content: `${getFinalRecommendationPrompt()}\n\nIMPORTANT: Respond with ONLY the JSON object. No markdown, no explanation, no code fences. Start your response with { and end with }.`,
      });

      const structuredResponse = await chatCompletion(state.messages, {
        taskType: 'recommendation',
        maxTokens: 8192,
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

  // Check confidence threshold - only reject very low confidence
  if (confidence < 40) {
    return { isValid: false, reason: `Very low confidence (${confidence}%) - should be wait` };
  }

  // For stock/options, validate R:R
  if (analysisType === 'stock' && entryPrice && stopLoss && priceTarget) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(priceTarget - entryPrice);
    const riskRewardRatio = risk > 0 ? reward / risk : 0;

    console.log(`[Agent] R:R Validation - Entry: ${entryPrice}, SL: ${stopLoss}, Target: ${priceTarget}`);
    console.log(`[Agent] R:R Validation - Risk: ${risk.toFixed(2)}, Reward: ${reward.toFixed(2)}, Ratio: ${riskRewardRatio.toFixed(2)}`);

    // Only reject if R:R is extremely poor (below 1:1)
    // Trades with R:R between 1:1 and 2:1 are still valid but noted
    if (riskRewardRatio < 1) {
      return {
        isValid: false,
        reason: `R:R ratio ${riskRewardRatio.toFixed(1)}:1 is below minimum 1:1 - risk exceeds reward`
      };
    }
  }

  return { isValid: true, reason: 'Trade meets quality requirements' };
}

// Robustly extract JSON from AI response content
function extractJSON(content: string): Record<string, unknown> | null {
  // 1. Try markdown code fences first: ```json ... ``` or ``` ... ```
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Code block content wasn't valid JSON, continue
    }
  }

  // 2. Find the outermost balanced JSON object
  const firstBrace = content.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = firstBrace; i < content.length; i++) {
      const ch = content[i];

      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;

      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const jsonStr = content.slice(firstBrace, i + 1);
          try {
            return JSON.parse(jsonStr);
          } catch {
            // Try cleaning trailing commas and single-line comments
            const cleaned = jsonStr
              .replace(/,\s*([}\]])/g, '$1')
              .replace(/\/\/[^\n]*/g, '');
            try {
              return JSON.parse(cleaned);
            } catch {
              break; // This balanced block failed, try greedy fallback
            }
          }
        }
      }
    }
  }

  // 3. Greedy fallback
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      const cleaned = jsonMatch[0]
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\/\/[^\n]*/g, '');
      try { return JSON.parse(cleaned); } catch { /* fall through */ }
    }
  }

  return null;
}

// Parse Claude's JSON recommendation
function parseRecommendation(
  content: string,
  symbol: string,
  analysisType: AnalysisType
): TradeRecommendation {
  try {
    // Extract JSON from the response using robust extractor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = extractJSON(content);
    if (!parsed) {
      throw new Error('No JSON found in response');
    }

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

    // Extract current price from various possible sources
    let currentPrice = parsed.current_price || parsed.currentPrice || null;
    // Fallback: try to get from forex_setup or stock_result
    if (!currentPrice && forexSetup?.currentPrice) {
      currentPrice = forexSetup.currentPrice;
    }
    if (!currentPrice && parsed.stock_result?.currentPrice) {
      currentPrice = parsed.stock_result.currentPrice;
    }

    // Extract entry_price, stop_loss, price_target from forex_setup or stock_result if top-level is missing
    // This ensures TradeRecommendation always has these fields for backtesting
    let entryPrice = parsed.entry_price || null;
    let stopLoss = parsed.stop_loss || null;
    let priceTarget = parsed.price_target || null;

    if (forexSetup?.trade) {
      // For forex, use forex_setup values if top-level is missing
      if (!entryPrice && forexSetup.trade.entryPrice) {
        entryPrice = forexSetup.trade.entryPrice;
      }
      if (!stopLoss && forexSetup.trade.stopLoss) {
        stopLoss = forexSetup.trade.stopLoss;
      }
      // For target, use TP3 (extended target) as the main price_target
      if (!priceTarget && forexSetup.trade.takeProfit3) {
        priceTarget = forexSetup.trade.takeProfit3;
      } else if (!priceTarget && forexSetup.trade.takeProfit2) {
        priceTarget = forexSetup.trade.takeProfit2;
      } else if (!priceTarget && forexSetup.trade.takeProfit1) {
        priceTarget = forexSetup.trade.takeProfit1;
      }
    }

    // For stock, use stock_result values if top-level is missing
    if (parsed.stock_result?.execution) {
      const exec = parsed.stock_result.execution;
      if (!entryPrice && exec.entryPrice) {
        entryPrice = typeof exec.entryPrice === 'number' ? exec.entryPrice : parseFloat(String(exec.entryPrice));
      }
      // stopLoss and profitTarget can be strings ("$185.50") or numbers (185.50) - handle both
      if (!stopLoss && exec.stopLoss != null) {
        if (typeof exec.stopLoss === 'number') {
          stopLoss = exec.stopLoss;
        } else {
          const slMatch = String(exec.stopLoss).match(/\$?([\d.]+)/);
          if (slMatch) stopLoss = parseFloat(slMatch[1]);
        }
      }
      if (!priceTarget && exec.profitTarget != null) {
        if (typeof exec.profitTarget === 'number') {
          priceTarget = exec.profitTarget;
        } else {
          const ptMatch = String(exec.profitTarget).match(/\$?([\d.]+)/);
          if (ptMatch) priceTarget = parseFloat(ptMatch[1]);
        }
      }
      // Also try to get from riskReward.breakeven as fallback for target
      if (!priceTarget && parsed.stock_result.riskReward?.breakeven) {
        priceTarget = parsed.stock_result.riskReward.breakeven;
      }
    }

    // For options_strategy, use legs for backtesting entry
    if (!entryPrice && fixedOptionsStrategy?.legs?.length) {
      // Use current price as entry for options (since options entry is the premium)
      if (currentPrice) {
        entryPrice = currentPrice;
      }
    }

    console.log('[Agent] Extracted prices:', { entryPrice, stopLoss, priceTarget, currentPrice, source: parsed.stock_result?.execution ? 'stock_result' : forexSetup?.trade ? 'forex_setup' : 'top-level' });

    // Validate trade quality AFTER extracting all prices
    const validation = validateTradeQuality(
      parsed.recommendation || 'hold',
      entryPrice,
      stopLoss,
      priceTarget,
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

    // Validate and return
    return {
      symbol: parsed.symbol || symbol.toUpperCase(),
      analysis_type: parsed.analysis_type || analysisType,
      recommendation: finalRecommendation,
      confidence: parsed.confidence || 50,
      current_price: currentPrice,
      price_target: priceTarget,
      stop_loss: stopLoss,
      entry_price: entryPrice,
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

    // Try to extract useful data from text when JSON parsing fails
    const priceMatch = content.match(/(?:current|market)\s*(?:price|rate)[:\s]*\$?([\d.]+)/i);
    const currentPrice = priceMatch ? parseFloat(priceMatch[1]) : null;

    // Try to detect recommendation from text
    let textRec: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' | 'wait' = 'hold';
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('strong buy') || lowerContent.includes('strong_buy')) textRec = 'strong_buy';
    else if (lowerContent.includes('strong sell') || lowerContent.includes('strong_sell')) textRec = 'strong_sell';
    else if (/\bbuy\b/.test(lowerContent) && !/\bdon'?t buy\b/.test(lowerContent)) textRec = 'buy';
    else if (/\bsell\b/.test(lowerContent) && !/\bdon'?t sell\b/.test(lowerContent)) textRec = 'sell';
    else if (/\bwait\b/.test(lowerContent) || /\bno trade\b/.test(lowerContent)) textRec = 'wait';

    // Try to extract timeframe
    const tfMatch = content.match(/(?:timeframe|time\s*frame)[:\s]*([\w\s\-/]+?)(?:\.|,|\n|$)/i);
    const timeframe = tfMatch ? tfMatch[1].trim().slice(0, 30) : 'Short-term';

    // Try to extract confidence
    const confMatch = content.match(/(?:confidence)[:\s]*(\d+)%?/i);
    const confidence = confMatch ? Math.min(parseInt(confMatch[1]), 100) : 40;

    console.log(`[Agent] Text fallback - rec: ${textRec}, price: ${currentPrice}, conf: ${confidence}, tf: ${timeframe}`);

    return {
      symbol: symbol.toUpperCase(),
      analysis_type: analysisType,
      recommendation: textRec,
      confidence,
      current_price: currentPrice,
      price_target: null,
      stop_loss: null,
      entry_price: null,
      timeframe,
      reasoning: content.slice(0, 2000),
      key_factors: [],
      risks: ['Analysis was provided as text - JSON parsing failed. Key levels may be missing.'],
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
// Returns undefined if data is invalid
function parseForexSetup(raw: Record<string, unknown>, symbol: string): TradeRecommendation['forex_setup'] | undefined {
  // Handle the new nested format from the comprehensive prompt
  const trade = raw.trade as Record<string, unknown> | undefined;
  const levels = raw.levels as Record<string, unknown> | undefined;
  const indicators = raw.indicators as Record<string, unknown> | undefined;
  const timing = raw.timing as Record<string, unknown> | undefined;
  const newsWarning = raw.news_warning as Record<string, unknown> | undefined;

  // Get current price (market price) - different from entry price
  const rawCurrentPrice = Number(raw.current_price || trade?.current_price || 0);

  // Get raw values from AI
  const rawEntryPrice = Number(trade?.entry_price || raw.entry_price || 0);
  const rawStopLoss = Number(getNestedValue(levels, 'stop_loss') || trade?.stop_loss || raw.stop_loss_price || 0);
  const rawTp1 = Number(getNestedValue(levels, 'take_profit_1') || trade?.take_profit_1 || raw.take_profit_price || 0);
  const rawTp2 = Number(getNestedValue(levels, 'take_profit_2') || trade?.take_profit_2 || 0);
  const rawTp3 = Number(getNestedValue(levels, 'take_profit_3') || trade?.take_profit_3 || 0);

  // Try to get a valid price from support/resistance levels as fallback
  const support1 = Number((levels?.key_support as number[])?.[0] || 0);
  const resistance1 = Number((levels?.key_resistance as number[])?.[0] || 0);

  // Determine pip multiplier, min valid price, and default pip ranges based on instrument type
  //
  // STANDARD PIP VALUES (with 0.1 lot = $1 per pip):
  // - EUR/USD: 1 pip = 0.0001, 0.1 lot = $1/pip, 1 lot = $10/pip
  // - USD/JPY: 1 pip = 0.01, 0.1 lot = $1/pip (approx), 1 lot = $10/pip
  // - XAU/USD (Gold): 1 pip = $0.10, 0.1 lot (10 oz) = $1/pip, 1 lot (100 oz) = $10/pip
  // - XAG/USD (Silver): 1 pip = $0.01, 0.1 lot (500 oz) = $5/pip, 1 lot (5000 oz) = $50/pip
  // - XTI/USD (Oil): 1 pip = $0.01, 0.1 lot (10 barrels) = $0.10/pip, 1 lot (100 barrels) = $1/pip
  //
  const upperSymbol = symbol.toUpperCase();
  const isJPY = upperSymbol.includes('JPY');
  const isGold = upperSymbol.includes('XAU');
  const isSilver = upperSymbol.includes('XAG');
  const isOil = upperSymbol.includes('XTI') || upperSymbol.includes('XBR') || upperSymbol.includes('OIL');

  let pipMultiplier: number;
  let minValidPrice: number;
  let instrumentType: 'standard' | 'jpy' | 'gold' | 'silver' | 'oil';

  if (isGold) {
    // Gold: 1 pip = $0.10 price movement
    // Example: 2050.00 to 2050.10 = 1 pip
    // 0.1 lot (10 oz) × 1 pip ($0.10) = $1
    pipMultiplier = 10; // price × 10 = pips (e.g., $0.10 move = 1 pip)
    minValidPrice = 1000;
    instrumentType = 'gold';
  } else if (isSilver) {
    // Silver: 1 pip = $0.01 price movement (same as oil)
    // Example: 23.50 to 23.51 = 1 pip
    // 0.1 lot (500 oz) × 1 pip ($0.01) = $5.00
    pipMultiplier = 100;
    minValidPrice = 10;
    instrumentType = 'silver';
  } else if (isOil) {
    // Oil: 1 pip = $0.01 price movement
    // Example: 78.50 to 78.51 = 1 pip
    // 0.1 lot (10 barrels) × 1 pip ($0.01) = $0.10
    pipMultiplier = 100;
    minValidPrice = 30;
    instrumentType = 'oil';
  } else if (isJPY) {
    // JPY pairs: 1 pip = 0.01 yen movement
    // Example: 149.50 to 149.51 = 1 pip
    // 0.1 lot × 1 pip = ~$0.67 (varies with exchange rate)
    pipMultiplier = 100;
    minValidPrice = 50;
    instrumentType = 'jpy';
  } else {
    // Standard pairs: 1 pip = 0.0001 movement
    // Example: 1.0850 to 1.0851 = 1 pip
    // 0.1 lot × 1 pip = $1
    pipMultiplier = 10000;
    minValidPrice = 0.1;
    instrumentType = 'standard';
  }

  console.log(`[Agent] Instrument: ${upperSymbol}, Type: ${instrumentType}, Pip Multiplier: ${pipMultiplier}`);

  // Entry price MUST be provided by the AI - no fallbacks
  // We only use current price for display, NOT for fabricating entries
  const entryPrice = rawEntryPrice;
  const currentPrice = rawCurrentPrice >= minValidPrice ? rawCurrentPrice : 0;

  // If AI didn't provide a valid entry price, there's no trade setup
  if (entryPrice < minValidPrice) {
    console.log(`[Agent] Invalid entry price ${entryPrice} - AI did not provide a valid trade setup`);
    console.log('[Agent] Not fabricating forex_setup - returning undefined');
    return undefined;
  }

  // Validate that SL and TPs are also valid prices (not 0)
  if (rawStopLoss < minValidPrice || rawTp1 < minValidPrice) {
    console.log(`[Agent] Invalid SL (${rawStopLoss}) or TP1 (${rawTp1}) - incomplete trade setup`);
    console.log('[Agent] Not fabricating forex_setup - returning undefined');
    return undefined;
  }

  const direction = (trade?.direction || raw.direction || 'long') as string;
  const isLong = direction.toLowerCase() === 'long' || direction.toLowerCase() === 'buy';

  // Default pip values vary by instrument type
  // Gold/Silver/Oil use 0.01 pips, so need larger pip counts for equivalent % moves
  // Standard forex: 25 pips = 0.25% move on EUR/USD at 1.0000
  // Gold: 500 pips = $5.00 move = 0.25% on gold at $2000
  let DEFAULT_SL_PIPS: number;
  let DEFAULT_TP1_PIPS: number;
  let DEFAULT_TP2_PIPS: number;
  let DEFAULT_TP3_PIPS: number;

  switch (instrumentType) {
    case 'gold':
      // Gold: 1 pip = $0.10, so 50 pips = $5.00 move
      // With 0.1 lot: 50 pips = $50 profit/loss
      DEFAULT_SL_PIPS = 50;    // $5.00 price move (e.g., 2050 to 2045)
      DEFAULT_TP1_PIPS = 50;   // $5.00 = 1:1 R:R
      DEFAULT_TP2_PIPS = 100;  // $10.00 = 2:1 R:R
      DEFAULT_TP3_PIPS = 150;  // $15.00 = 3:1 R:R
      break;
    case 'silver':
      // Silver: 1 pip = $0.01, so 50 pips = $0.50 move
      // With 0.1 lot (500 oz): 50 pips = $250 profit/loss
      DEFAULT_SL_PIPS = 50;    // $0.50 price move (e.g., 23.50 to 23.00)
      DEFAULT_TP1_PIPS = 50;   // $0.50 = 1:1 R:R
      DEFAULT_TP2_PIPS = 100;  // $1.00 = 2:1 R:R
      DEFAULT_TP3_PIPS = 150;  // $1.50 = 3:1 R:R
      break;
    case 'oil':
      // Oil: 1 pip = $0.01, so 50 pips = $0.50 move
      // With 0.1 lot (10 barrels): 50 pips = $5 profit/loss
      DEFAULT_SL_PIPS = 50;    // $0.50 price move (e.g., 78.50 to 78.00)
      DEFAULT_TP1_PIPS = 50;   // $0.50 = 1:1 R:R
      DEFAULT_TP2_PIPS = 100;  // $1.00 = 2:1 R:R
      DEFAULT_TP3_PIPS = 150;  // $1.50 = 3:1 R:R
      break;
    case 'jpy':
      // JPY pairs: similar to standard but using 0.01 pip
      DEFAULT_SL_PIPS = 25;
      DEFAULT_TP1_PIPS = 25;
      DEFAULT_TP2_PIPS = 50;
      DEFAULT_TP3_PIPS = 75;
      break;
    default: // 'standard'
      // Standard forex pairs (EUR/USD, GBP/USD, etc.)
      DEFAULT_SL_PIPS = 25;
      DEFAULT_TP1_PIPS = 25;
      DEFAULT_TP2_PIPS = 50;
      DEFAULT_TP3_PIPS = 75;
  }

  // CRITICAL: Validate and fix direction of SL and TPs
  // For LONG/BUY: SL should be BELOW entry, TPs should be ABOVE entry
  // For SHORT/SELL: SL should be ABOVE entry, TPs should be BELOW entry
  let stopLossPrice: number;
  let tp1Price: number;
  let tp2Price: number;
  let tp3Price: number;

  if (isLong) {
    // LONG: SL below entry, TPs above entry
    const slValid = rawStopLoss > 0 && rawStopLoss < entryPrice;
    const tp1Valid = rawTp1 > 0 && rawTp1 > entryPrice;
    const tp2Valid = rawTp2 > 0 && rawTp2 > entryPrice;
    const tp3Valid = rawTp3 > 0 && rawTp3 > entryPrice;

    // Calculate pip distances from valid values or use defaults
    const slPips = slValid ? Math.abs((entryPrice - rawStopLoss) * pipMultiplier) : DEFAULT_SL_PIPS;
    const tp1Pips = tp1Valid ? Math.abs((rawTp1 - entryPrice) * pipMultiplier) : DEFAULT_TP1_PIPS;
    const tp2Pips = tp2Valid ? Math.abs((rawTp2 - entryPrice) * pipMultiplier) : DEFAULT_TP2_PIPS;
    const tp3Pips = tp3Valid ? Math.abs((rawTp3 - entryPrice) * pipMultiplier) : DEFAULT_TP3_PIPS;

    // Set correct prices (LONG: SL below, TPs above)
    stopLossPrice = slValid ? rawStopLoss : entryPrice - (slPips / pipMultiplier);
    tp1Price = tp1Valid ? rawTp1 : entryPrice + (tp1Pips / pipMultiplier);
    tp2Price = tp2Valid ? rawTp2 : entryPrice + (tp2Pips / pipMultiplier);
    tp3Price = tp3Valid ? rawTp3 : entryPrice + (tp3Pips / pipMultiplier);
  } else {
    // SHORT: SL above entry, TPs below entry
    const slValid = rawStopLoss > 0 && rawStopLoss > entryPrice;
    const tp1Valid = rawTp1 > 0 && rawTp1 < entryPrice;
    const tp2Valid = rawTp2 > 0 && rawTp2 < entryPrice;
    const tp3Valid = rawTp3 > 0 && rawTp3 < entryPrice;

    // Calculate pip distances from valid values or use defaults
    const slPips = slValid ? Math.abs((rawStopLoss - entryPrice) * pipMultiplier) : DEFAULT_SL_PIPS;
    const tp1Pips = tp1Valid ? Math.abs((entryPrice - rawTp1) * pipMultiplier) : DEFAULT_TP1_PIPS;
    const tp2Pips = tp2Valid ? Math.abs((entryPrice - rawTp2) * pipMultiplier) : DEFAULT_TP2_PIPS;
    const tp3Pips = tp3Valid ? Math.abs((entryPrice - rawTp3) * pipMultiplier) : DEFAULT_TP3_PIPS;

    // Set correct prices (SHORT: SL above, TPs below)
    stopLossPrice = slValid ? rawStopLoss : entryPrice + (slPips / pipMultiplier);
    tp1Price = tp1Valid ? rawTp1 : entryPrice - (tp1Pips / pipMultiplier);
    tp2Price = tp2Valid ? rawTp2 : entryPrice - (tp2Pips / pipMultiplier);
    tp3Price = tp3Valid ? rawTp3 : entryPrice - (tp3Pips / pipMultiplier);
  }

  // Calculate final pip distances (now guaranteed correct direction)
  const slPips = Math.abs((entryPrice - stopLossPrice) * pipMultiplier);
  const tp1Pips = Math.abs((tp1Price - entryPrice) * pipMultiplier);
  const tp2Pips = Math.abs((tp2Price - entryPrice) * pipMultiplier);
  const tp3Pips = Math.abs((tp3Price - entryPrice) * pipMultiplier);

  // Determine order type based on entry vs current price
  // BUY: entry < current = BUY LIMIT (waiting for pullback), entry > current = BUY STOP (breakout)
  // SELL: entry > current = SELL LIMIT (waiting for rally), entry < current = SELL STOP (breakdown)
  let orderType: 'BUY_LIMIT' | 'BUY_STOP' | 'SELL_LIMIT' | 'SELL_STOP' | 'MARKET';
  const priceToUse = currentPrice > 0 ? currentPrice : entryPrice;

  if (isLong) {
    orderType = entryPrice < priceToUse ? 'BUY_LIMIT' : entryPrice > priceToUse ? 'BUY_STOP' : 'MARKET';
  } else {
    orderType = entryPrice > priceToUse ? 'SELL_LIMIT' : entryPrice < priceToUse ? 'SELL_STOP' : 'MARKET';
  }

  // Determine action based on direction
  const action = isLong ? 'BUY' : 'SELL';

  return {
    pair: String(trade?.pair || raw.pair || symbol),
    currentPrice: priceToUse,
    direction: isLong ? 'BULLISH' : 'BEARISH',

    trade: {
      action,
      orderType: orderType as 'LIMIT' | 'MARKET' | 'BUY_LIMIT' | 'BUY_STOP' | 'SELL_LIMIT' | 'SELL_STOP',
      entryPrice,
      stopLoss: stopLossPrice,
      takeProfit1: tp1Price,
      takeProfit2: tp2Price,
      takeProfit3: tp3Price,
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
      entryInstructions: `Place ${orderType.replace('_', ' ')} order at ${entryPrice}`,
      profitTargets: `TP1: ${Math.round(tp1Pips)} pips, TP2: ${Math.round(tp2Pips)} pips, TP3: ${Math.round(tp3Pips)} pips`,
      stopLossRules: `Set SL at ${stopLossPrice} (${Math.round(slPips)} pips)`,
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
