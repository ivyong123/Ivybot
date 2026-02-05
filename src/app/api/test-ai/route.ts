import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const TEST_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_stock_price',
    description: 'Get stock price',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Stock symbol' },
      },
      required: ['symbol'],
    },
  },
};

export async function GET(request: NextRequest) {
  const results: Record<string, unknown> = {};

  // Test OpenRouter
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      console.log('[Test] Testing OpenRouter...');
      const openRouterClient = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: openRouterKey,
        defaultHeaders: {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'CheekyTrader AI Test',
        },
      });

      const completion = await openRouterClient.chat.completions.create({
        model: 'anthropic/claude-3.7-sonnet',
        messages: [{ role: 'user', content: 'Say "Hello" only.' }],
        max_tokens: 20,
      });

      results.openrouter = {
        status: 'ok',
        model: completion.model,
        response: completion.choices[0]?.message?.content,
        finish_reason: completion.choices[0]?.finish_reason,
      };
      console.log('[Test] OpenRouter success:', results.openrouter);

      // Test with tools
      console.log('[Test] Testing OpenRouter with tools...');
      const toolCompletion = await openRouterClient.chat.completions.create({
        model: 'anthropic/claude-3.7-sonnet',
        messages: [{ role: 'user', content: 'Get the stock price for AAPL' }],
        tools: [TEST_TOOL],
        tool_choice: 'auto',
        max_tokens: 500,
      });

      results.openrouter_with_tools = {
        status: 'ok',
        model: toolCompletion.model,
        finish_reason: toolCompletion.choices[0]?.finish_reason,
        has_tool_calls: !!toolCompletion.choices[0]?.message?.tool_calls?.length,
        tool_calls: toolCompletion.choices[0]?.message?.tool_calls?.map(tc => {
          const toolCall = tc as { id: string; function?: { name: string; arguments: string } };
          return {
            id: toolCall.id,
            name: toolCall.function?.name ?? 'unknown',
            args: toolCall.function?.arguments ?? '{}',
          };
        }),
      };
      console.log('[Test] OpenRouter with tools success:', results.openrouter_with_tools);

    } catch (error: unknown) {
      const err = error as Error & { status?: number; code?: string };
      console.error('[Test] OpenRouter error:', err);
      results.openrouter = {
        status: 'error',
        message: err.message,
        errorStatus: err.status,
        errorCode: err.code,
      };
    }
  } else {
    results.openrouter = { status: 'error', message: 'API key not configured' };
  }

  // Test OpenAI
  const openAIKey = process.env.OPENAI_API_KEY;
  if (openAIKey) {
    try {
      console.log('[Test] Testing OpenAI...');
      const openAIClient = new OpenAI({
        apiKey: openAIKey,
      });

      const completion = await openAIClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Say "Hello" only.' }],
        max_tokens: 20,
      });

      results.openai = {
        status: 'ok',
        model: completion.model,
        response: completion.choices[0]?.message?.content,
        finish_reason: completion.choices[0]?.finish_reason,
      };
      console.log('[Test] OpenAI success:', results.openai);

      // Test OpenAI with tools
      console.log('[Test] Testing OpenAI with tools...');
      const toolCompletion = await openAIClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Get the stock price for AAPL' }],
        tools: [TEST_TOOL],
        tool_choice: 'auto',
        max_tokens: 500,
      });

      results.openai_with_tools = {
        status: 'ok',
        model: toolCompletion.model,
        finish_reason: toolCompletion.choices[0]?.finish_reason,
        has_tool_calls: !!toolCompletion.choices[0]?.message?.tool_calls?.length,
        tool_calls: toolCompletion.choices[0]?.message?.tool_calls?.map(tc => {
          const toolCall = tc as { id: string; function: { name: string; arguments: string } };
          return {
            id: toolCall.id,
            name: toolCall.function.name,
            args: toolCall.function.arguments,
          };
        }),
      };
      console.log('[Test] OpenAI with tools success:', results.openai_with_tools);

    } catch (error: unknown) {
      const err = error as Error & { status?: number; code?: string };
      console.error('[Test] OpenAI error:', err);
      results.openai = {
        status: 'error',
        message: err.message,
        errorStatus: err.status,
        errorCode: err.code,
      };
    }
  } else {
    results.openai = { status: 'error', message: 'API key not configured' };
  }

  return NextResponse.json(results);
}
