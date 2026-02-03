import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatCompletion } from '@/lib/ai/openrouter-client';
import { searchKnowledgeBase, formatContextForPrompt } from '@/lib/rag';
import { ChatMessage } from '@/types/ai';
import { z } from 'zod';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversation_id: z.string().optional(),
  include_kb: z.boolean().optional().default(true),
  kb_type: z.enum(['stock', 'forex']).optional().default('stock'),
});

// Simple web search function using a search API
async function searchWeb(query: string): Promise<string> {
  try {
    // Use DuckDuckGo instant answer API (free, no key required)
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );

    if (!response.ok) {
      return 'Web search unavailable.';
    }

    const data = await response.json();

    let results = '';

    if (data.Abstract) {
      results += `Summary: ${data.Abstract}\n`;
    }

    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      results += '\nRelated Information:\n';
      data.RelatedTopics.slice(0, 5).forEach((topic: { Text?: string }) => {
        if (topic.Text) {
          results += `- ${topic.Text}\n`;
        }
      });
    }

    return results || 'No relevant results found.';
  } catch (error) {
    console.error('Web search error:', error);
    return 'Web search temporarily unavailable.';
  }
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

const CHAT_SYSTEM_PROMPT = `You are CheekyTrader AI, a helpful trading assistant with access to real-time information and the user's trading analysis history.

Current Date: ${new Date().toISOString().split('T')[0]}

Your Capabilities:
1. Knowledge Base: Access to comprehensive trading education materials
2. Web Search: Can search the internet for current market news and information
3. Analysis History: Can reference the user's previous trading analyses

Guidelines:
- Be conversational and helpful
- Explain complex concepts in simple terms
- Use the provided context (knowledge base, web search, analysis history) to ground your responses
- Always clarify that you're providing educational information, not financial advice
- When discussing specific stocks or trades, recommend using the Analysis feature for detailed recommendations
- Reference the user's past analyses when relevant to provide personalized insights
- For current market conditions or news, use the web search results provided

When knowledge base, web search results, or analysis history is provided, use it to give more accurate and relevant responses.`;

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

    const { message, include_kb, kb_type } = validationResult.data;

    // Build messages array
    const messages: ChatMessage[] = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ];

    // Gather context from multiple sources in parallel
    const contextPromises: Promise<{ type: string; content: string }>[] = [];

    // Knowledge base search
    if (include_kb) {
      contextPromises.push(
        searchKnowledgeBase(message, kb_type, 3)
          .then((context) => ({
            type: 'knowledge_base',
            content: context.chunks.length > 0 ? formatContextForPrompt(context) : '',
          }))
          .catch(() => ({ type: 'knowledge_base', content: '' }))
      );
    }

    // Web search for market-related queries
    const marketKeywords = ['price', 'market', 'stock', 'news', 'today', 'current', 'now', 'latest'];
    const shouldSearchWeb = marketKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword)
    );

    if (shouldSearchWeb) {
      contextPromises.push(
        searchWeb(`${message} stock market finance`)
          .then((content) => ({ type: 'web_search', content }))
      );
    }

    // User's analysis history
    const analysisKeywords = ['my', 'previous', 'history', 'past', 'analysis', 'analyzed', 'portfolio'];
    const shouldIncludeHistory = analysisKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword)
    );

    if (shouldIncludeHistory) {
      contextPromises.push(
        getUserAnalysisHistory(user.id)
          .then((content) => ({ type: 'analysis_history', content }))
      );
    }

    // Wait for all context to be gathered
    const contextResults = await Promise.all(contextPromises);

    // Add context to messages
    let hasContext = false;
    for (const ctx of contextResults) {
      if (ctx.content) {
        hasContext = true;
        let contextLabel = '';
        switch (ctx.type) {
          case 'knowledge_base':
            contextLabel = `Trading Knowledge Base Context`;
            break;
          case 'web_search':
            contextLabel = `Web Search Results`;
            break;
          case 'analysis_history':
            contextLabel = `Your Analysis History`;
            break;
        }
        messages.push({
          role: 'system',
          content: `[${contextLabel}]\n${ctx.content}`,
        });
      }
    }

    // Add user message
    messages.push({ role: 'user', content: message });

    // Get AI response (using chat task type for conversational responses)
    const response = await chatCompletion(messages, {
      taskType: 'chat',
      maxTokens: 2048,
    });

    const assistantMessage = response.choices[0]?.message?.content;

    if (!assistantMessage) {
      return NextResponse.json(
        { error: 'No response generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: assistantMessage,
      kb_used: hasContext,
      sources: contextResults.filter((c) => c.content).map((c) => c.type),
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
