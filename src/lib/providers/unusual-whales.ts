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

  console.log(`[Unusual Whales API] Calling ${endpoint} with params:`, params);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Unusual Whales API] Error ${response.status}:`, error);
    throw new Error(`Unusual Whales API error: ${response.status} - ${error}`);
  }

  console.log(`[Unusual Whales API] Success for ${endpoint}`);
  return response.json();
}

// Flow Alert response from Unusual Whales API
interface UWFlowAlert {
  alert_rule: string;
  all_opening_trades: boolean;
  created_at: string;
  expiry: string;
  expiry_count: number;
  has_floor: boolean;
  has_multileg: boolean;
  has_singleleg: boolean;
  has_sweep: boolean;
  issue_type: string;
  open_interest: number;
  option_chain: string;
  price: string;
  strike: string;
  ticker: string;
  total_ask_side_prem: string;
  total_bid_side_prem: string;
  total_premium: string;
  total_size: number;
  trade_count: number;
  type: 'call' | 'put';
  underlying_price: string;
  volume: number;
  volume_oi_ratio: string;
}

interface FlowAlertsResponse {
  data: UWFlowAlert[];
}

// Determine sentiment based on flow characteristics
function determineSentiment(flow: UWFlowAlert): 'bullish' | 'bearish' | 'neutral' {
  const askPrem = parseFloat(flow.total_ask_side_prem) || 0;
  const bidPrem = parseFloat(flow.total_bid_side_prem) || 0;
  const isCall = flow.type === 'call';

  // Ask side = buying, bid side = selling
  // Buying calls or selling puts = bullish
  // Buying puts or selling calls = bearish
  if (askPrem > bidPrem * 1.5) {
    // Mostly buying
    return isCall ? 'bullish' : 'bearish';
  } else if (bidPrem > askPrem * 1.5) {
    // Mostly selling
    return isCall ? 'bearish' : 'bullish';
  }

  return 'neutral';
}

// Get unusual options flow for a symbol
export async function getUnusualOptionsFlow(symbol: string): Promise<UnusualFlowSummary> {
  const upperSymbol = symbol.toUpperCase();

  try {
    // Use the new flow-alerts endpoint with ticker_symbol filter
    const response = await uwFetch<FlowAlertsResponse>('/option-trades/flow-alerts', {
      ticker_symbol: upperSymbol,
    });

    if (!response.data || response.data.length === 0) {
      console.log(`[Unusual Whales] No flow alerts found for ${upperSymbol}`);
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

    console.log(`[Unusual Whales] Found ${response.data.length} flow alerts for ${upperSymbol}`);

    const flows: UnusualOptionsFlow[] = response.data.map((flow) => {
      const sentiment = determineSentiment(flow);

      return {
        symbol: upperSymbol,
        timestamp: flow.created_at,
        option_symbol: flow.option_chain,
        expiration: flow.expiry,
        strike: parseFloat(flow.strike),
        option_type: flow.type,
        sentiment,
        volume: flow.volume,
        open_interest: flow.open_interest,
        volume_oi_ratio: parseFloat(flow.volume_oi_ratio) || 0,
        premium: parseFloat(flow.total_premium),
        underlying_price: parseFloat(flow.underlying_price),
        trade_type: flow.has_sweep ? 'sweep' : (flow.has_multileg ? 'multi_leg' : 'block'),
      };
    });

    // Calculate summary statistics
    let totalCallPremium = 0;
    let totalPutPremium = 0;
    let bullishCount = 0;
    let bearishCount = 0;
    const strikeMap = new Map<number, number>();

    for (const flow of flows) {
      const premium = flow.premium || 0;

      if (flow.option_type === 'call') {
        totalCallPremium += premium;
      } else {
        totalPutPremium += premium;
      }

      if (flow.sentiment === 'bullish') bullishCount++;
      if (flow.sentiment === 'bearish') bearishCount++;

      // Track notable strikes by premium
      const currentPremium = strikeMap.get(flow.strike) || 0;
      strikeMap.set(flow.strike, currentPremium + premium);
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

    console.log(`[Unusual Whales] ${upperSymbol} summary: ${flows.length} flows, sentiment: ${overallSentiment}, call/put ratio: ${callPutRatio.toFixed(2)}`);

    return {
      symbol: upperSymbol,
      flows,
      total_call_premium: totalCallPremium,
      total_put_premium: totalPutPremium,
      call_put_ratio: callPutRatio,
      overall_sentiment: overallSentiment,
      notable_strikes: notableStrikes,
    };
  } catch (error) {
    console.error(`[Unusual Whales] Error fetching flow for ${upperSymbol}:`, error);
    throw error;
  }
}
