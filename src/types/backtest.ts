// Backtesting Types

export interface BacktestRecord {
  id: string;
  job_id: string;
  user_id: string;
  symbol: string;
  analysis_type: 'stock' | 'forex';

  // Prediction details
  prediction_date: string;
  predicted_direction: 'bullish' | 'bearish' | 'neutral';
  entry_price: number;
  target_price: number;
  stop_loss: number;
  timeframe: string; // e.g., "4 weeks"
  expiry_date: string;
  confidence: number;

  // For options
  options_strategy?: string;
  options_expiration?: string;

  // For forex
  tp1_price?: number;
  tp2_price?: number;
  tp3_price?: number;

  // Outcome tracking
  status: 'pending' | 'won' | 'lost' | 'expired' | 'partial';
  actual_exit_price?: number;
  actual_exit_date?: string;
  pnl_percent?: number;
  pnl_amount?: number;
  hit_target?: boolean;
  hit_stop?: boolean;

  // For forex TPs
  hit_tp1?: boolean;
  hit_tp2?: boolean;
  hit_tp3?: boolean;

  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BacktestStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  pending_trades: number;
  expired_trades: number;

  win_rate: number; // percentage
  avg_win_percent: number;
  avg_loss_percent: number;
  profit_factor: number; // total wins / total losses

  // By direction
  bullish_trades: number;
  bullish_wins: number;
  bearish_trades: number;
  bearish_wins: number;

  // By confidence level
  high_confidence_trades: number; // confidence > 70
  high_confidence_wins: number;
  low_confidence_trades: number;
  low_confidence_wins: number;

  // Time-based
  avg_trade_duration_days: number;

  // Recent performance
  last_10_trades_win_rate: number;
  last_30_days_win_rate: number;

  // Best/worst
  best_trade_percent: number;
  worst_trade_percent: number;
  best_symbol: string;
  worst_symbol: string;
}

export interface BacktestSummary {
  stats: BacktestStats;
  recent_trades: BacktestRecord[];
  by_symbol: Record<string, { trades: number; wins: number; losses: number; pending: number; win_rate: number }>;
  by_strategy: Record<string, { trades: number; wins: number; win_rate: number }>;
  monthly_performance: Array<{
    month: string;
    trades: number;
    wins: number;
    win_rate: number;
    total_pnl_percent: number;
  }>;
}

export interface PriceCheck {
  symbol: string;
  current_price: number;
  high_since_entry: number;
  low_since_entry: number;
  timestamp: string;
}
