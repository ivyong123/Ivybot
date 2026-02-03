import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface DiagnosticResult {
  name: string;
  status: 'ok' | 'error' | 'warning';
  message: string;
  details?: string;
}

async function checkPolygon(): Promise<DiagnosticResult> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return { name: 'Polygon.io', status: 'error', message: 'API key not configured' };
  }

  try {
    const response = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/AAPL?apiKey=${apiKey}`
    );

    if (response.ok) {
      return { name: 'Polygon.io', status: 'ok', message: 'Connected - Real-time data available' };
    } else if (response.status === 403) {
      return {
        name: 'Polygon.io',
        status: 'warning',
        message: 'API key valid but limited',
        details: 'Free tier may not include real-time snapshots. Historical data should work.'
      };
    } else {
      const error = await response.text();
      return { name: 'Polygon.io', status: 'error', message: `API error: ${response.status}`, details: error };
    }
  } catch (error) {
    return { name: 'Polygon.io', status: 'error', message: 'Connection failed', details: String(error) };
  }
}

async function checkFinnhub(): Promise<DiagnosticResult> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return { name: 'Finnhub', status: 'error', message: 'API key not configured' };
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${apiKey}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.c && data.c > 0) {
        return { name: 'Finnhub', status: 'ok', message: 'Connected - Options chain available' };
      } else {
        return { name: 'Finnhub', status: 'warning', message: 'Connected but no data returned' };
      }
    } else {
      const error = await response.text();
      return { name: 'Finnhub', status: 'error', message: `API error: ${response.status}`, details: error };
    }
  } catch (error) {
    return { name: 'Finnhub', status: 'error', message: 'Connection failed', details: String(error) };
  }
}

async function checkBenzinga(): Promise<DiagnosticResult> {
  const apiKey = process.env.BENZINGA_API_KEY;
  if (!apiKey) {
    return { name: 'Benzinga', status: 'error', message: 'API key not configured' };
  }

  try {
    const response = await fetch(
      `https://api.benzinga.com/api/v2.1/calendar/earnings?token=${apiKey}&parameters[tickers]=AAPL`
    );

    if (response.ok) {
      return { name: 'Benzinga', status: 'ok', message: 'Connected - Earnings & analyst data available' };
    } else {
      const error = await response.text();
      return { name: 'Benzinga', status: 'error', message: `API error: ${response.status}`, details: error };
    }
  } catch (error) {
    return { name: 'Benzinga', status: 'error', message: 'Connection failed', details: String(error) };
  }
}

async function checkUnusualWhales(): Promise<DiagnosticResult> {
  const apiKey = process.env.UNUSUAL_WHALES_API_KEY;
  if (!apiKey) {
    return { name: 'Unusual Whales', status: 'error', message: 'API key not configured' };
  }

  try {
    const response = await fetch(
      `https://api.unusualwhales.com/api/stock/AAPL/flow-alerts`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (response.ok) {
      return { name: 'Unusual Whales', status: 'ok', message: 'Connected - Smart money flow available' };
    } else if (response.status === 401 || response.status === 403) {
      return {
        name: 'Unusual Whales',
        status: 'error',
        message: 'API key invalid or expired',
        details: 'Unusual Whales requires a paid subscription'
      };
    } else {
      const error = await response.text();
      return { name: 'Unusual Whales', status: 'error', message: `API error: ${response.status}`, details: error };
    }
  } catch (error) {
    return { name: 'Unusual Whales', status: 'error', message: 'Connection failed', details: String(error) };
  }
}

async function checkOpenRouter(): Promise<DiagnosticResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { name: 'OpenRouter (AI)', status: 'error', message: 'API key not configured' };
  }

  try {
    // First check if API key is valid
    const authResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!authResponse.ok) {
      return { name: 'OpenRouter (AI)', status: 'error', message: 'API key invalid', details: `Status: ${authResponse.status}` };
    }

    const authData = await authResponse.json();
    const credits = authData.data?.limit_remaining;

    // Now test actual completion with Claude 3.5 Sonnet
    const testResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'CheekyTrader AI',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: 'Say "OK" only.' }],
        max_tokens: 10,
      }),
    });

    if (testResponse.ok) {
      return {
        name: 'OpenRouter (AI)',
        status: 'ok',
        message: 'Connected - Claude 3.5 Sonnet working',
        details: `Credits: $${credits?.toFixed(2) || 'unknown'}`
      };
    } else {
      const errorData = await testResponse.json().catch(() => ({}));
      return {
        name: 'OpenRouter (AI)',
        status: 'error',
        message: `Model test failed: ${testResponse.status}`,
        details: JSON.stringify(errorData)
      };
    }
  } catch (error) {
    return { name: 'OpenRouter (AI)', status: 'error', message: 'Connection failed', details: String(error) };
  }
}

async function checkOpenAI(): Promise<DiagnosticResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { name: 'OpenAI (Fallback)', status: 'warning', message: 'API key not configured - no fallback available' };
  }

  try {
    // Test actual completion with GPT-4o
    const testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Say "OK" only.' }],
        max_tokens: 10,
      }),
    });

    if (testResponse.ok) {
      return {
        name: 'OpenAI (Fallback)',
        status: 'ok',
        message: 'Connected - GPT-4o available as fallback',
      };
    } else {
      const errorData = await testResponse.json().catch(() => ({}));
      return {
        name: 'OpenAI (Fallback)',
        status: 'error',
        message: `API error: ${testResponse.status}`,
        details: JSON.stringify(errorData)
      };
    }
  } catch (error) {
    return { name: 'OpenAI (Fallback)', status: 'error', message: 'Connection failed', details: String(error) };
  }
}

async function checkSupabase(): Promise<DiagnosticResult> {
  try {
    const supabase = await createClient();

    // Check if documents table exists and has data
    const { count: docCount, error: docError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (docError) {
      return {
        name: 'Supabase (Knowledge Base)',
        status: 'error',
        message: 'Database error',
        details: docError.message
      };
    }

    return {
      name: 'Supabase (Knowledge Base)',
      status: docCount && docCount > 0 ? 'ok' : 'warning',
      message: docCount && docCount > 0
        ? `Connected - ${docCount} documents in knowledge base`
        : 'Connected but knowledge base is empty'
    };
  } catch (error) {
    return { name: 'Supabase (Knowledge Base)', status: 'error', message: 'Connection failed', details: String(error) };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run all diagnostics in parallel
    const results = await Promise.all([
      checkOpenRouter(),
      checkOpenAI(),
      checkPolygon(),
      checkFinnhub(),
      checkBenzinga(),
      checkUnusualWhales(),
      checkSupabase(),
    ]);

    const allOk = results.every(r => r.status === 'ok');
    const hasErrors = results.some(r => r.status === 'error');

    return NextResponse.json({
      overall: allOk ? 'healthy' : hasErrors ? 'degraded' : 'partial',
      results,
      summary: {
        ok: results.filter(r => r.status === 'ok').length,
        warnings: results.filter(r => r.status === 'warning').length,
        errors: results.filter(r => r.status === 'error').length,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Diagnostics failed', details: String(error) }, { status: 500 });
  }
}
