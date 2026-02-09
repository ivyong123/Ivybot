import OpenAI from 'openai';
import { ChatCompletionRequest, ChatCompletionResponse, ChatMessage, OpenRouterTool } from '@/types/ai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Convert technical errors to user-friendly messages
function getUserFriendlyError(error: Error & { status?: number; code?: string }, provider: string): string {
  const message = error.message?.toLowerCase() || '';
  const status = error.status;

  // API key issues
  if (status === 401 || message.includes('api key') || message.includes('unauthorized') || message.includes('authentication')) {
    return "We're having trouble connecting to our AI service. Our team has been notified and is working on it. Please try again in a few minutes.";
  }

  // Rate limiting
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return "Our AI is experiencing high demand right now. Please wait a moment and try again.";
  }

  // Quota/billing issues
  if (message.includes('quota') || message.includes('billing') || message.includes('insufficient')) {
    return "We're experiencing a temporary service issue. Our team has been notified. Please try again later.";
  }

  // Network/timeout issues
  if (message.includes('timeout') || message.includes('network') || message.includes('econnrefused')) {
    return "Unable to connect to our AI service. Please check your internet connection and try again.";
  }

  // Model not available
  if (message.includes('model') && (message.includes('not found') || message.includes('does not exist'))) {
    return "The AI service is temporarily unavailable. Please try again in a moment.";
  }

  // Server errors
  if (status && status >= 500) {
    return "Our AI service is temporarily down. Please try again in a few minutes.";
  }

  // Generic fallback
  return "Something went wrong with the analysis. Please try again. If the problem persists, try again later.";
}

// Model configurations for different task types
// OpenRouter: uses prefixed names (anthropic/claude-3.7-sonnet)
// OpenAI direct API: uses unprefixed names (gpt-4o)
export const MODEL_CONFIG = {
  // For analysis tasks requiring accuracy and tool use
  analysis: {
    primary: 'anthropic/claude-3.7-sonnet', // Claude 3.7 Sonnet via OpenRouter
    fallback: 'gpt-4o', // OpenAI GPT-4o fallback
    temperature: 0.2, // Low temperature for consistent, accurate results
  },
  // For reflection/critique tasks
  reflection: {
    primary: 'anthropic/claude-3.7-sonnet',
    fallback: 'gpt-4o',
    temperature: 0.2, // Low for consistent critique
  },
  // For chat/conversational tasks
  chat: {
    primary: 'anthropic/claude-3.7-sonnet',
    fallback: 'gpt-4o-mini', // Cheaper fallback for chat
    temperature: 0.7, // Higher for natural conversation
  },
  // For final recommendation generation
  recommendation: {
    primary: 'anthropic/claude-3.7-sonnet',
    fallback: 'gpt-4o',
    temperature: 0.2, // Low for consistent recommendations
  },
} as const;

export type TaskType = keyof typeof MODEL_CONFIG;

interface APIConfig {
  baseURL: string;
  apiKey: string;
  headers?: Record<string, string>;
}

function getOpenRouterConfig(): APIConfig | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  return {
    baseURL: OPENROUTER_BASE_URL,
    apiKey: key,
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'CheekyTrader AI',
    },
  };
}

function getOpenAIConfig(): APIConfig | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  return {
    baseURL: 'https://api.openai.com/v1',
    apiKey: key,
  };
}

// Create client for specific provider
function createClient(config: APIConfig): OpenAI {
  return new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    defaultHeaders: config.headers,
  });
}

// Execute completion with a specific client
async function executeCompletion(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
  options: {
    tools?: OpenRouterTool[];
    temperature: number;
    maxTokens: number;
  }
): Promise<ChatCompletionResponse> {
  const completion = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id,
      name: m.name,
    })) as OpenAI.ChatCompletionMessageParam[],
    tools: options.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    })),
    tool_choice: options.tools ? 'auto' : undefined,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  });

  // Map response to our types
  return {
    id: completion.id,
    object: completion.object,
    created: completion.created,
    model: completion.model,
    choices: completion.choices.map((choice) => ({
      index: choice.index,
      message: {
        role: choice.message.role as 'assistant',
        content: choice.message.content,
        tool_calls: choice.message.tool_calls?.map((tc) => {
          if (tc.type === 'function' && 'function' in tc) {
            const funcTc = tc as { id: string; type: 'function'; function: { name: string; arguments: string } };
            return {
              id: funcTc.id,
              type: 'function' as const,
              function: {
                name: funcTc.function.name,
                arguments: funcTc.function.arguments,
              },
            };
          }
          return {
            id: tc.id,
            type: 'function' as const,
            function: {
              name: '',
              arguments: '{}',
            },
          };
        }),
      },
      finish_reason: choice.finish_reason as 'stop' | 'tool_calls' | 'length' | 'content_filter',
    })),
    usage: {
      prompt_tokens: completion.usage?.prompt_tokens || 0,
      completion_tokens: completion.usage?.completion_tokens || 0,
      total_tokens: completion.usage?.total_tokens || 0,
    },
  };
}

// Retry helper with exponential backoff for rate limiting
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as Error & { status?: number };
      lastError = err;
      // Only retry on 429 (rate limit) or 503 (service unavailable)
      if ((err.status === 429 || err.status === 503) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000); // 1s, 2s, 4s, 8s
        console.log(`[AI] ${label} got ${err.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Main chat completion function with fallback support
export async function chatCompletion(
  messages: ChatMessage[],
  options: {
    model?: string;
    tools?: OpenRouterTool[];
    temperature?: number;
    maxTokens?: number;
    taskType?: TaskType;
  } = {}
): Promise<ChatCompletionResponse> {
  const {
    tools,
    maxTokens = 4096,
    taskType = 'analysis',
  } = options;

  // Get task-specific configuration
  const taskConfig = MODEL_CONFIG[taskType];

  // Use provided temperature or task-specific default
  const temperature = options.temperature ?? taskConfig.temperature;

  // Use provided model or task-specific default
  const primaryModel = options.model || taskConfig.primary;
  const fallbackModel = taskConfig.fallback;

  // Try OpenRouter first
  const openRouterConfig = getOpenRouterConfig();
  console.log(`[AI] OpenRouter config exists: ${!!openRouterConfig}, API key starts with: ${openRouterConfig?.apiKey?.slice(0, 15)}...`);

  if (openRouterConfig) {
    try {
      const client = createClient(openRouterConfig);
      console.log(`[AI] Using OpenRouter with ${primaryModel} (temp: ${temperature}, tools: ${tools?.length || 0})`);

      const response = await withRetry(
        () => executeCompletion(client, primaryModel, messages, {
          tools,
          temperature,
          maxTokens,
        }),
        'OpenRouter'
      );

      console.log(`[AI] Response received - finish_reason: ${response.choices[0]?.finish_reason}, has_content: ${!!response.choices[0]?.message?.content}, has_tool_calls: ${!!response.choices[0]?.message?.tool_calls?.length}`);

      return response;
    } catch (error: unknown) {
      const err = error as Error & { status?: number; code?: string; response?: { data?: unknown } };
      console.error('[AI] OpenRouter failed:', err.message);
      console.error('[AI] OpenRouter error status:', err.status);
      console.error('[AI] OpenRouter error code:', err.code);
      if (err.response?.data) {
        console.error('[AI] OpenRouter error response:', JSON.stringify(err.response.data));
      }
      console.log('[AI] >>> Falling through to OpenAI fallback...');
      // Fall through to OpenAI fallback
    }
  } else {
    console.log('[AI] OpenRouter not configured, trying OpenAI...');
  }

  // Try OpenAI as fallback
  const openAIConfig = getOpenAIConfig();
  console.log(`[AI] OpenAI config exists: ${!!openAIConfig}, API key starts with: ${openAIConfig?.apiKey?.slice(0, 15)}...`);

  if (openAIConfig) {
    try {
      const client = createClient(openAIConfig);
      console.log(`[AI] Falling back to OpenAI with ${fallbackModel} (temp: ${temperature}, tools: ${tools?.length || 0})`);

      const response = await withRetry(
        () => executeCompletion(client, fallbackModel, messages, {
          tools,
          temperature,
          maxTokens,
        }),
        'OpenAI'
      );

      console.log(`[AI] OpenAI response received - finish_reason: ${response.choices[0]?.finish_reason}`);
      return response;
    } catch (error: unknown) {
      const err = error as Error & { status?: number; code?: string; response?: { data?: unknown } };
      console.error('[AI] OpenAI fallback failed:', err.message);
      console.error('[AI] OpenAI error status:', err.status);
      console.error('[AI] OpenAI error code:', err.code);
      if (err.response?.data) {
        console.error('[AI] OpenAI error response:', JSON.stringify(err.response.data));
      }
      // Create user-friendly error message
      const userMessage = getUserFriendlyError(err, 'OpenAI');
      throw new Error(userMessage);
    }
  }

  throw new Error("We're having trouble connecting to our AI service. Please try again later.");
}

// Legacy function for backwards compatibility
export function createOpenRouterClient() {
  const config = getOpenRouterConfig();
  if (!config) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }
  return createClient(config);
}

// Streaming chat completion with fallback
export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: {
    model?: string;
    tools?: OpenRouterTool[];
    temperature?: number;
    maxTokens?: number;
    taskType?: TaskType;
  } = {}
): AsyncGenerator<{ type: 'content' | 'tool_call'; data: unknown }> {
  const {
    tools,
    maxTokens = 4096,
    taskType = 'chat',
  } = options;

  const taskConfig = MODEL_CONFIG[taskType];
  const temperature = options.temperature ?? taskConfig.temperature;
  const model = options.model || taskConfig.primary;

  // Try to get a working client
  let client: OpenAI | null = null;
  let activeModel = model;

  const openRouterConfig = getOpenRouterConfig();
  if (openRouterConfig) {
    client = createClient(openRouterConfig);
  } else {
    const openAIConfig = getOpenAIConfig();
    if (openAIConfig) {
      client = createClient(openAIConfig);
      activeModel = taskConfig.fallback;
    }
  }

  if (!client) {
    throw new Error("We're having trouble connecting to our AI service. Please try again later.");
  }

  const stream = await client.chat.completions.create({
    model: activeModel,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id,
      name: m.name,
    })) as OpenAI.ChatCompletionMessageParam[],
    tools: tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    })),
    tool_choice: tools ? 'auto' : undefined,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    if (delta?.content) {
      yield { type: 'content', data: delta.content };
    }

    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        yield {
          type: 'tool_call',
          data: {
            id: toolCall.id,
            name: toolCall.function?.name,
            arguments: toolCall.function?.arguments,
          },
        };
      }
    }
  }
}
