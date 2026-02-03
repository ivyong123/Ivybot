-- Backtest Records Table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS backtest_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES trading_analysis_jobs(id),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  analysis_type VARCHAR(10) NOT NULL CHECK (analysis_type IN ('stock', 'forex')),

  -- Prediction details
  prediction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  predicted_direction VARCHAR(10) NOT NULL CHECK (predicted_direction IN ('bullish', 'bearish', 'neutral')),
  entry_price DECIMAL(20, 8) NOT NULL,
  target_price DECIMAL(20, 8) NOT NULL,
  stop_loss DECIMAL(20, 8) NOT NULL,
  timeframe VARCHAR(50),
  expiry_date TIMESTAMPTZ NOT NULL,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),

  -- Options specific
  options_strategy VARCHAR(50),
  options_expiration DATE,

  -- Forex specific (multiple TPs)
  tp1_price DECIMAL(20, 8),
  tp2_price DECIMAL(20, 8),
  tp3_price DECIMAL(20, 8),

  -- Outcome tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'expired', 'partial')),
  actual_exit_price DECIMAL(20, 8),
  actual_exit_date TIMESTAMPTZ,
  pnl_percent DECIMAL(10, 4),
  pnl_amount DECIMAL(20, 8),
  hit_target BOOLEAN DEFAULT FALSE,
  hit_stop BOOLEAN DEFAULT FALSE,

  -- Forex TP tracking
  hit_tp1 BOOLEAN DEFAULT FALSE,
  hit_tp2 BOOLEAN DEFAULT FALSE,
  hit_tp3 BOOLEAN DEFAULT FALSE,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_backtest_user_id ON backtest_records(user_id);
CREATE INDEX idx_backtest_status ON backtest_records(status);
CREATE INDEX idx_backtest_symbol ON backtest_records(symbol);
CREATE INDEX idx_backtest_created_at ON backtest_records(created_at DESC);
CREATE INDEX idx_backtest_expiry_date ON backtest_records(expiry_date);

-- RLS Policies
ALTER TABLE backtest_records ENABLE ROW LEVEL SECURITY;

-- Users can only view their own records
CREATE POLICY "Users can view own backtest records" ON backtest_records
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own records
CREATE POLICY "Users can insert own backtest records" ON backtest_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for background jobs)
CREATE POLICY "Service role full access" ON backtest_records
  FOR ALL USING (auth.role() = 'service_role');

-- Enable realtime for backtest records
ALTER PUBLICATION supabase_realtime ADD TABLE backtest_records;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_backtest_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backtest_records_updated_at
  BEFORE UPDATE ON backtest_records
  FOR EACH ROW
  EXECUTE FUNCTION update_backtest_updated_at();
