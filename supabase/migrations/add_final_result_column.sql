-- Add missing columns to trading_analysis_jobs if they don't exist
-- Run this in your Supabase SQL editor

-- Add final_result column (JSONB to store the full recommendation)
ALTER TABLE trading_analysis_jobs ADD COLUMN IF NOT EXISTS final_result JSONB;

-- Add initial_analysis column if missing
ALTER TABLE trading_analysis_jobs ADD COLUMN IF NOT EXISTS initial_analysis TEXT;

-- Add critique column if missing
ALTER TABLE trading_analysis_jobs ADD COLUMN IF NOT EXISTS critique TEXT;

-- Add tools_called column if missing (array of tool calls)
ALTER TABLE trading_analysis_jobs ADD COLUMN IF NOT EXISTS tools_called JSONB DEFAULT '[]';

-- Add error column if missing
ALTER TABLE trading_analysis_jobs ADD COLUMN IF NOT EXISTS error TEXT;

-- Add progress column if missing
ALTER TABLE trading_analysis_jobs ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- Add current_step column if missing
ALTER TABLE trading_analysis_jobs ADD COLUMN IF NOT EXISTS current_step TEXT;

-- Verify RLS is enabled
ALTER TABLE trading_analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
    -- Policy for users to view their own jobs
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'trading_analysis_jobs'
        AND policyname = 'Users can view own jobs'
    ) THEN
        CREATE POLICY "Users can view own jobs" ON trading_analysis_jobs
          FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- Policy for users to create their own jobs
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'trading_analysis_jobs'
        AND policyname = 'Users can create jobs'
    ) THEN
        CREATE POLICY "Users can create jobs" ON trading_analysis_jobs
          FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- Also grant service_role full access (for background jobs)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'trading_analysis_jobs'
        AND policyname = 'Service role full access'
    ) THEN
        CREATE POLICY "Service role full access" ON trading_analysis_jobs
          FOR ALL USING (auth.role() = 'service_role');
    END IF;
END
$$;
