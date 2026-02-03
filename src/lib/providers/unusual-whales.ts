import { UnusualOptionsFlow, UnusualFlowSummary } from '@/types/market-data';

const UW_BASE_URL = 'https://api.unusualwhales.com/api';

function getApiKey(): string {
  const key = process.env.UNUSUAL_WHALES_API_KEY;
  if (!key) {
    throw new Error('UNUSUAL_WHALES_API_KEY not configured');
  }
  return key;
}

async function uwFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${UW_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Unusual Whales API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Get unusual options flow for a symbol
export async function getUnusualOptionsFlow(symbol: string): Promise<UnusualFlowSummary> {
  const upperSymbol = symbol.toUpperCase();

  interface UWFlowItem {
    id: string;
    ticker: string;
    strike: number;
    expiry: string;
    option_type: 'C' | 'P';
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    volume: number;
    open_interest: number;
    premium: number;
    underlying_price: number;
    timestamp: string;
    trade_type: string;
  }

  interface FlowResponse {
    data: UWFlowItem[];
  }

  const response = await uwFetch<FlowResponse>('/stock/flow', {
    ticker: upperSymbol,
    limit: '50',
  });

  if (!response.data || response.data.length === 0) {
    return {
      symbol: upperSymbol,
      flows: [],
      total_call_premium: 0,
      total_put_premium: 0,
      call_put_ratio: 1,
      overall_sentiment: 'neutral',
      notable_strikes: [],
    };
  }

  const flows: UnusualOptionsFlow[] = response.data.map((flow) => ({
    symbol: upperSymbol,
    timestamp: flow.timestamp,
    option_symbol: `${flow.ticker}${flow.expiry}${flow.option_type}${flow.strike}`,
    expiration: flow.expiry,
    strike: flow.strike,
    option_type: flow.option_type === 'C' ? 'call' : 'put',
    sentiment: flow.sentiment.toLowerCase() as 'bullish' | 'bearish' | 'neutral',
    volume: flow.volume,
    open_interest: flow.open_interest,
    volume_oi_ratio: flow.open_interest > 0 ? flow.volume / flow.open_interest : 0,
    premium: flow.premium,
    underlying_price: flow.underlying_price,
    trade_type: flow.trade_type.toLowerCase() as 'sweep' | 'block' | 'split' | 'multi_leg',
  }));

  // Calculate summary statistics
  let totalCallPremium = 0;
  let totalPutPremium = 0;
  let bullishCount = 0;
  let bearishCount = 0;
  const strikeMap = new Map<number, number>();

  for (const flow of flows) {
    if (flow.option_type === 'call') {
      totalCallPremium += flow.premium;
    } else {
      totalPutPremium += flow.premium;
    }

    if (flow.sentiment === 'bullish') bullishCount++;
    if (flow.sentiment === 'bearish') bearishCount++;

    // Track notable strikes by premium
    const currentPremium = strikeMap.get(flow.strike) || 0;
    strikeMap.set(flow.strike, currentPremium + flow.premium);
  }

  // Get top 5 strikes by premium
  const notableStrikes = Array.from(strikeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([strike]) => strike);

  // Determine overall sentiment
  let overallSentiment: 'bullish' | 'bearish' | 'neutral';
  const callPutRatio = totalPutPremium > 0 ? totalCallPremium / totalPutPremium : 1;

  if (bullishCount > bearishCount * 1.5 || callPutRatio > 2) {
    overallSentiment = 'bullish';
  } else if (bearishCount > bullishCount * 1.5 || callPutRatio < 0.5) {
    overallSentiment = 'bearish';
  } else {
    overallSentiment = 'neutral';
  }

  return {
    symbol: upperSymbol,
    flows,
    total_call_premium: totalCallPremium,
    total_put_premium: totalPutPremium,
    call_put_ratio: callPutRatio,
    overall_sentiment: overallSentiment,
    notable_strikes: notableStrikes,
  };
}
