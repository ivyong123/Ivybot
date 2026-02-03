// Full analysis types (agentic AI with multiple tools, reflection, recommendations)
export type FullAnalysisType = 'stock' | 'forex';

// Standalone data types (single tool, AI summary, no trading prediction)
export type StandaloneType = 'technical' | 'fundamentals' | 'earnings' | 'news' | 'smart_money';

// Combined type for all analysis options
export type AnalysisType = FullAnalysisType | StandaloneType;

// Helper to check if an analysis type is standalone
export function isStandaloneAnalysis(type: AnalysisType): type is StandaloneType {
  return ['technical', 'fundamentals', 'earnings', 'news', 'smart_money'].includes(type);
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AnalysisJob {
  id: string;
  user_id: string;
  symbol: string;
  analysis_type: AnalysisType;
  status: JobStatus;
  progress: number;
  current_step: string | null;
  tools_called: ToolCall[];
  initial_analysis: string | null;
  critique: string | null;
  final_result: TradeRecommendation | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  duration_ms?: number;
  timestamp: string;
}

export interface TradeRecommendation {
  symbol: string;
  analysis_type: AnalysisType;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' | 'wait';
  confidence: number; // 0-100
  price_target: number | null;
  stop_loss: number | null;
  entry_price: number | null;
  timeframe: string;
  reasoning: string;
  key_factors: KeyFactor[];
  risks: string[];
  // Stock/Options specific - includes detailed strategy with Greeks
  options_strategy?: OptionsStrategy;
  // Stock/Options comprehensive result (new format)
  stock_result?: StockOptionsResult;
  // Forex comprehensive result (new format with multiple TPs)
  forex_setup?: ForexSetup;
  data_sources: string[];
  generated_at: string;
}

export interface KeyFactor {
  factor: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  weight: number; // 0-100
  source: string;
}

// Options strategy types
export type OptionsStrategyType =
  | 'long_call'
  | 'long_put'
  | 'covered_call'
  | 'cash_secured_put'
  | 'bull_call_spread'
  | 'bear_put_spread'
  | 'bull_put_spread'
  | 'bear_call_spread'
  | 'iron_condor'
  | 'iron_butterfly'
  | 'long_straddle'
  | 'long_strangle'
  | 'short_straddle'
  | 'short_strangle'
  | 'calendar_spread'
  | 'diagonal_spread'
  | 'butterfly_spread'
  | 'collar'
  | 'protective_put'
  | 'synthetic_long'
  | 'synthetic_short';

export interface OptionsStrategy {
  strategy_type: OptionsStrategyType | string;
  strategy_description: string; // Human-readable description of the strategy
  legs: OptionLeg[];
  max_profit: number | null;
  max_loss: number | null;
  breakeven: number[];
  probability_of_profit: number | null;
  days_to_expiration: number;
  risk_reward_ratio: number | null; // e.g., 2.5 means 2.5:1 reward to risk
  net_debit_credit: number | null; // Positive = debit, Negative = credit
  implied_volatility: number | null; // Overall IV for the position
}

export interface OptionLeg {
  action: 'buy' | 'sell';
  option_type: 'call' | 'put';
  strike: number;
  expiration: string;
  quantity: number;
  premium: number | null;
  // Greeks for each leg
  greeks: OptionGreeks | null;
}

export interface OptionGreeks {
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  implied_volatility: number | null;
}

// Forex-specific output - Comprehensive structure with multiple TPs
export interface ForexSetup {
  pair: string;
  currentPrice: number;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

  trade: {
    action: 'BUY' | 'SELL';
    orderType: 'LIMIT' | 'MARKET';
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3: number;
    stopLossPips: number;
    takeProfit1Pips: number;
    takeProfit2Pips: number;
    takeProfit3Pips: number;
    riskRewardRatio: string; // e.g., "1:1.5"
  };

  riskManagement: {
    riskPercent: number;
    suggestedLotSize: number;
    maxRiskDollars: number;
    pipValue: number;
    calculation: string;
  };

  levels: {
    support1: number;
    support2: number;
    support3: number;
    resistance1: number;
    resistance2: number;
    resistance3: number;
    dailyPivot: number;
    atr: number;
  };

  indicators: {
    rsi: { value: number; interpretation: string };
    macd: { value: number; signal: number; histogram: number; interpretation: string };
    ema: { ema20: number; ema50: number; ema200: number; interpretation: string };
    stochastic: { k: number; d: number; interpretation: string };
  };

  analysis: {
    trend: string;
    technicalSetup: string;
    economicCalendar: string;
    sessionAnalysis: string;
    riskFactors: string[];
  };

  confidence: {
    score: number;
    level: 'HIGH' | 'MODERATE' | 'LOW';
    explanation: string;
  };

  execution: {
    entryInstructions: string;
    profitTargets: string;
    stopLossRules: string;
    managementRules: string[];
  };

  timing: {
    currentSession: string;
    optimalEntry: string;
    newsWarnings: string[];
    expiryTime: string;
  };
}

// Stock/Options - Comprehensive structure with smart money analysis
export interface StockOptionsResult {
  strategy: string;
  ticker: string;
  currentPrice: number;
  recommendation: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CAUTION';

  legs: Array<{
    action: 'BUY' | 'SELL';
    strike: number;
    expiration: string;
    type: 'CALL' | 'PUT';
    contract: string; // Contract name from options chain
  }>;

  riskReward: {
    maxRisk: number; // Per contract (×100)
    maxReward: number | 'UNLIMITED';
    breakeven: number;
    ratio: string;
    riskCalculation: string;
    rewardCalculation: string;
  };

  greeks: {
    delta: number;
    deltaInterp: string;
    theta: number;
    thetaInterp: string;
    gamma: number;
    gammaInterp: string;
    vega: number;
    vegaInterp: string;
  };

  analysis: {
    technical: string;
    fundamentals: string;
    news: string;
    strategyFit: string;
    smartMoney: {
      alignment: 'STRONGLY ALIGNS' | 'ALIGNS' | 'NEUTRAL' | 'CONFLICTS' | 'STRONGLY CONFLICTS';
      analysis: string;
    };
    risks: string;
    probability: string;
  };

  confidence: {
    score: number;
    level: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
    explanation: string;
  };

  execution: {
    orderType: 'LIMIT' | 'MARKET';
    entryPrice: number;
    entryInstructions: string;
    profitTarget: string;
    stopLoss: string;
    managementRules: string[];
  };
}

export interface CreateAnalysisRequest {
  symbol: string;
  analysis_type: AnalysisType;
  additional_context?: string;
}

export interface AnalysisProgress {
  job_id: string;
  status: JobStatus;
  progress: number;
  current_step: string | null;
  tools_called: ToolCall[];
}
