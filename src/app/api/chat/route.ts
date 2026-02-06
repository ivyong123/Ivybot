import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatCompletion } from '@/lib/ai/openrouter-client';
import { searchKnowledgeBase, formatContextForPrompt } from '@/lib/rag';
import { executeToolCalls } from '@/lib/ai/executor';
import { ChatMessage, OpenRouterTool, ToolCallRequest } from '@/types/ai';
import { z } from 'zod';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversation_id: z.string().optional(),
  include_kb: z.boolean().optional().default(true),
  kb_type: z.enum(['stock', 'forex']).optional().default('stock'),
});

// Chat-specific tools - a subset of analysis tools for conversational use
const CHAT_TOOLS: OpenRouterTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_stock_price',
      description: 'Get the current stock price, daily change, and volume for a given ticker symbol. Use this when the user asks about a stock price.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol (e.g., AAPL, MSFT, TSLA)',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_forex_quote',
      description: 'Get real-time forex quote with bid/ask prices for a currency pair. Use this when the user asks about forex rates.',
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
      name: 'get_news_sentiment',
      description: 'Get recent news articles and sentiment analysis for a stock. Use this when the user asks about news or sentiment.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock ticker symbol',
          },
          days: {
            type: 'number',
            description: 'Number of days of news to analyze (default: 7)',
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
      name: 'get_historical_data',
      description: 'Get historical OHLCV data for technical analysis. Use this when the user asks about price history or trends.',
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
        },
        required: ['symbol', 'timeframe'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_earnings_calendar',
      description: 'Get upcoming and recent earnings dates with estimates and actuals. Use this when the user asks about earnings.',
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
      description: 'Get analyst ratings, price targets, and consensus recommendation. Use this when the user asks about analyst opinions.',
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
      description: 'Search the trading knowledge base for strategies, patterns, and educational content. Use this to answer trading education questions.',
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
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current market news, events, or general information. Use this for recent news, current events, or information not in the knowledge base.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_economic_calendar',
      description: 'Get economic calendar events that could impact a currency pair. Use this for forex-related economic events.',
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

// Web search function using DuckDuckGo
async function searchWeb(query: string): Promise<{ summary: string; results: string[] }> {
  try {
    // Use DuckDuckGo instant answer API (free, no key required)
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );

    if (!response.ok) {
      return { summary: '', results: ['Web search unavailable.'] };
    }

    const data = await response.json();

    const results: string[] = [];
    let summary = '';

    if (data.Abstract) {
      summary = data.Abstract;
    }

    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      data.RelatedTopics.slice(0, 5).forEach((topic: { Text?: string; FirstURL?: string }) => {
        if (topic.Text) {
          results.push(topic.Text);
        }
      });
    }

    // Also try to get news-like results from the Answer field
    if (data.Answer) {
      results.unshift(data.Answer);
    }

    return { summary, results };
  } catch (error) {
    console.error('Web search error:', error);
    return { summary: '', results: ['Web search temporarily unavailable.'] };
  }
}

// Execute web search tool separately (not in main executor)
async function executeWebSearch(query: string): Promise<string> {
  const { summary, results } = await searchWeb(query);

  let output = '';
  if (summary) {
    output += `Summary: ${summary}\n\n`;
  }
  if (results.length > 0) {
    output += 'Search Results:\n';
    results.forEach((r, i) => {
      output += `${i + 1}. ${r}\n`;
    });
  }

  return output || 'No relevant results found.';
}

// Get user's recent analysis history
async function getUserAnalysisHistory(userId: string, limit: number = 5): Promise<string> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    const { data: jobs, error } = await supabase
      .from('trading_analysis_jobs')
      .select('symbol, analysis_type, created_at, final_result')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !jobs || jobs.length === 0) {
      return 'No previous analyses found.';
    }

    let history = 'Recent Analysis History:\n';
    jobs.forEach((job) => {
      const date = new Date(job.created_at).toLocaleDateString();
      const result = job.final_result;
      if (result) {
        history += `- ${job.symbol} (${job.analysis_type}): ${result.recommendation?.replace('_', ' ').toUpperCase() || 'N/A'}, `;
        history += `Confidence: ${result.confidence || 'N/A'}%, `;
        history += `Target: $${result.price_target || 'N/A'} - ${date}\n`;
      }
    });

    return history;
  } catch (error) {
    console.error('Failed to fetch analysis history:', error);
    return 'Unable to retrieve analysis history.';
  }
}

const CHAT_SYSTEM_PROMPT = `You are CheekyTrader AI, a helpful trading assistant with access to REAL-TIME market data tools.

Current Date: ${new Date().toISOString().split('T')[0]}

## Your Tools
You have access to the following tools to help users:

1. **get_stock_price** - Get current stock prices, daily change, volume
2. **get_forex_quote** - Get real-time forex quotes with bid/ask
3. **get_news_sentiment** - Get news articles and sentiment for stocks
4. **get_historical_data** - Get price history for technical analysis
5. **get_earnings_calendar** - Get upcoming earnings dates and estimates
6. **get_analyst_ratings** - Get analyst ratings and price targets
7. **search_trading_knowledge** - Search the trading education knowledge base
8. **web_search** - Search the web for current news and events
9. **get_economic_calendar** - Get forex economic calendar events

## When to Use Tools
- When user asks about a stock price → Use get_stock_price
- When user asks about forex rates → Use get_forex_quote
- When user asks about news → Use get_news_sentiment
- When user asks about price history/charts → Use get_historical_data
- When user asks about earnings → Use get_earnings_calendar
- When user asks about analyst opinions → Use get_analyst_ratings
- When user asks educational questions → Use search_trading_knowledge
- When user asks about current events/news → Use web_search
- When user asks about economic events for forex → Use get_economic_calendar

## Guidelines
- USE YOUR TOOLS to get real data - don't make up prices or information
- Be conversational and helpful
- Explain complex concepts in simple terms
- Always clarify that you're providing educational information, not financial advice
- For detailed trade recommendations, suggest using the Analysis feature
- When showing prices, always show the timestamp/date of the data

## Response Format
- Keep responses concise but informative
- Use markdown formatting for readability
- When showing data, format it cleanly
- Include relevant context when presenting numbers`;

// Maximum tool execution rounds to prevent infinite loops
const MAX_TOOL_ROUNDS = 3;

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = ChatRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { message, conversation_id, kb_type } = validationResult.data;

    // Generate or use conversation ID for memory
    const convId = conversation_id || `conv_${user.id}_${Date.now()}`;

    // Build messages array
    const messages: ChatMessage[] = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ];

    // Load conversation history from database for memory
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase = createAdminClient();

    // Get previous messages for this conversation (last 10 messages for context)
    const { data: historyMessages } = await adminSupabase
      .from('n8n_chat_histories')
      .select('message')
      .eq('session_id', convId)
      .order('id', { ascending: true })
      .limit(10);

    if (historyMessages && historyMessages.length > 0) {
      console.log(`[Chat] Loading ${historyMessages.length} previous messages for context`);
      for (const row of historyMessages) {
        try {
          const msg = typeof row.message === 'string' ? JSON.parse(row.message) : row.message;
          if (msg.role && msg.content) {
            messages.push({ role: msg.role, content: msg.content });
          }
        } catch {
          // Skip invalid messages
        }
      }
    }

    // Add user's analysis history context if relevant
    const analysisKeywords = ['my', 'previous', 'history', 'past', 'analysis', 'analyzed', 'portfolio'];
    const shouldIncludeHistory = analysisKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword)
    );

    if (shouldIncludeHistory) {
      const historyContext = await getUserAnalysisHistory(user.id);
      if (historyContext && historyContext !== 'No previous analyses found.') {
        messages.push({
          role: 'system',
          content: `[Your Analysis History]\n${historyContext}`,
        });
      }
    }

    // Add user message
    messages.push({ role: 'user', content: message });

    // Save user message to conversation history
    await adminSupabase.from('n8n_chat_histories').insert({
      session_id: convId,
      message: JSON.stringify({ role: 'user', content: message }),
    });

    // Track tools used and sources
    const toolsUsed: string[] = [];
    const sources: string[] = [];

    // Tool execution loop
    let toolRounds = 0;

    console.log('[Chat] Starting chat processing for message:', message.slice(0, 100));

    while (toolRounds < MAX_TOOL_ROUNDS) {
      console.log(`[Chat] Tool round ${toolRounds + 1}/${MAX_TOOL_ROUNDS}`);

      // Get AI response with tools available
      const response = await chatCompletion(messages, {
        taskType: 'chat',
        maxTokens: 2048,
        tools: CHAT_TOOLS,
      });

      console.log('[Chat] Got response from AI, finish_reason:', response.choices[0]?.finish_reason);

      const choice = response.choices[0];
      const assistantMessage = choice?.message;

      if (!assistantMessage) {
        return NextResponse.json(
          { error: 'No response generated' },
          { status: 500 }
        );
      }

      // Check if AI wants to use tools
      if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls?.length) {
        toolRounds++;
        console.log(`[Chat] AI requested ${assistantMessage.tool_calls.length} tool(s) in round ${toolRounds}`);

        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: assistantMessage.tool_calls,
        });

        // Process each tool call
        const toolResults: { tool_call_id: string; role: 'tool'; content: string }[] = [];

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          toolsUsed.push(toolName);
          console.log(`[Chat] Tool call: ${toolName}, id: ${toolCall.id}`);

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            console.error(`[Chat] Failed to parse tool arguments for ${toolName}:`, parseError);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify({ error: 'Invalid arguments' }),
            });
            continue;
          }

          console.log(`[Chat] Executing tool: ${toolName}`, JSON.stringify(args));

          // Handle web_search separately
          try {
            if (toolName === 'web_search') {
              sources.push('web_search');
              const searchResults = await executeWebSearch(args.query as string);
              console.log(`[Chat] Web search completed, result length: ${searchResults.length}`);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: searchResults,
              });
            } else {
              // Use the standard executor for other tools
              const executionResult = await executeToolCalls([
                {
                  id: toolCall.id,
                  type: 'function',
                  function: {
                    name: toolName,
                    arguments: toolCall.function.arguments,
                  },
                },
              ]);

              console.log(`[Chat] Tool ${toolName} executed, results: ${executionResult.toolResults.length}, errors: ${executionResult.errors.length}`);
              if (executionResult.errors.length > 0) {
                console.error(`[Chat] Tool ${toolName} errors:`, executionResult.errors);
              }

              // Track source type
              if (toolName === 'search_trading_knowledge') {
                sources.push('knowledge_base');
              } else if (toolName.startsWith('get_stock') || toolName.startsWith('get_forex') ||
                         toolName.includes('earnings') || toolName.includes('analyst') ||
                         toolName.includes('news') || toolName.includes('historical') ||
                         toolName.includes('economic')) {
                sources.push('market_data');
              }

              // Add tool results
              for (const result of executionResult.toolResults) {
                console.log(`[Chat] Tool result for ${toolCall.id}: ${result.content.slice(0, 200)}...`);
                toolResults.push({
                  tool_call_id: result.tool_call_id,
                  role: 'tool',
                  content: result.content,
                });
              }
            }
          } catch (toolError) {
            console.error(`[Chat] Tool ${toolName} threw error:`, toolError);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify({ error: `Tool execution failed: ${toolError instanceof Error ? toolError.message : 'Unknown error'}` }),
            });
          }
        }

        console.log(`[Chat] Round ${toolRounds} complete. Tool results: ${toolResults.length}`);

        // Add all tool results to messages
        for (const result of toolResults) {
          messages.push(result);
        }

        // Continue loop to let AI process tool results
        continue;
      }

      // AI is done (no more tool calls)
      // Return the final response
      const finalContent = assistantMessage.content;

      if (!finalContent) {
        return NextResponse.json(
          { error: 'No response generated' },
          { status: 500 }
        );
      }

      // Save assistant response to conversation history
      await adminSupabase.from('n8n_chat_histories').insert({
        session_id: convId,
        message: JSON.stringify({ role: 'assistant', content: finalContent }),
      });

      // Dedupe sources
      const uniqueSources = [...new Set(sources)];

      return NextResponse.json({
        message: finalContent,
        conversation_id: convId,
        kb_used: uniqueSources.length > 0,
        sources: uniqueSources,
        tools_used: [...new Set(toolsUsed)],
      });
    }

    // If we hit max tool rounds, log it and return what we have
    console.error('[Chat] Hit max tool rounds limit. Tools used:', toolsUsed);
    console.error('[Chat] Last messages count:', messages.length);

    // Try one more time without tools to get a final response
    try {
      console.log('[Chat] Attempting final response without tools...');
      const finalResponse = await chatCompletion(messages, {
        taskType: 'chat',
        maxTokens: 2048,
        // No tools - force a text response
      });

      const finalContent = finalResponse.choices[0]?.message?.content;
      if (finalContent) {
        console.log('[Chat] Got final response without tools');

        // Save to conversation history
        await adminSupabase.from('n8n_chat_histories').insert({
          session_id: convId,
          message: JSON.stringify({ role: 'assistant', content: finalContent }),
        });

        return NextResponse.json({
          message: finalContent,
          conversation_id: convId,
          kb_used: sources.length > 0,
          sources: [...new Set(sources)],
          tools_used: [...new Set(toolsUsed)],
        });
      }
    } catch (err) {
      console.error('[Chat] Final response attempt failed:', err);
    }

    return NextResponse.json({
      message: 'I apologize, but I\'m having trouble processing your request. Please try asking a simpler question.',
      conversation_id: convId,
      kb_used: false,
      sources: [],
      tools_used: toolsUsed,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    console.error('Error details:', error instanceof Error ? error.stack : 'Unknown error type');

    // Return a user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      {
        error: errorMessage,
        message: 'I apologize, but I encountered an error processing your request. Please try again.',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
