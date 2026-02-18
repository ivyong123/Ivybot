import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAnalysisAgent, updateJobStatus } from '@/lib/ai/agent';
import { runStandaloneAnalysis } from '@/lib/ai/standalone';
import { savePrediction } from '@/lib/backtest';
import { AnalysisType, FullAnalysisType, isStandaloneAnalysis, StandaloneType } from '@/types/analysis';
import { z } from 'zod';

const CreateAnalysisSchema = z.object({
  symbol: z.string().min(1).max(10),
  analysis_type: z.enum(['stock', 'forex', 'technical', 'fundamentals', 'earnings', 'news', 'smart_money']),
  additional_context: z.string().optional(),
  trading_timeframe: z.string().optional(),
});

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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateAnalysisSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { symbol, analysis_type, additional_context, trading_timeframe } = validationResult.data;

    // Check if this is a standalone (quick lookup) request
    if (isStandaloneAnalysis(analysis_type as AnalysisType)) {
      // Run standalone analysis immediately and return result
      const result = await runStandaloneAnalysis(symbol, analysis_type as StandaloneType);

      return NextResponse.json({
        standalone_result: result,
      });
    }

    // Full analysis - create job and run in background
    const adminClient = createAdminClient();
    const { data: job, error: createError } = await adminClient
      .from('trading_analysis_jobs')
      .insert({
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        analysis_type,
        status: 'pending',
        progress: 0,
        current_step: 'Initializing',
        tools_called: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !job) {
      console.error('Failed to create job:', createError);
      return NextResponse.json(
        { error: 'Failed to create analysis job' },
        { status: 500 }
      );
    }

    // Start async analysis (don't await - let it run in background)
    runAnalysisInBackground(job.id, symbol, analysis_type as FullAnalysisType, additional_context, trading_timeframe);

    return NextResponse.json({
      job_id: job.id,
      status: 'pending',
      message: 'Analysis started',
    });
  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Run analysis in background
async function runAnalysisInBackground(
  jobId: string,
  symbol: string,
  analysisType: FullAnalysisType,
  additionalContext?: string,
  tradingTimeframe?: string
) {
  try {
    // Update status to running
    await updateJobStatus(jobId, {
      status: 'running',
      progress: 5,
      current_step: 'Starting analysis',
    });

    // Run the agent
    const result = await runAnalysisAgent(
      symbol,
      analysisType,
      additionalContext,
      tradingTimeframe,
      // Progress callback
      async (update) => {
        await updateJobStatus(jobId, {
          progress: update.progress,
          current_step: update.step,
          tools_called: update.toolCalls,
        });
      }
    );

    // Update with final result
    console.log('[Route] Agent result:', {
      hasError: !!result.error,
      error: result.error,
      hasRecommendation: !!result.recommendation,
      recommendationSymbol: result.recommendation?.symbol,
      recommendationType: result.recommendation?.recommendation,
      toolCallsCount: result.toolCalls?.length,
    });

    if (result.error) {
      console.log('[Route] Updating job as FAILED');
      await updateJobStatus(jobId, {
        status: 'failed',
        error: result.error,
        tools_called: result.toolCalls,
        progress: 100,
        current_step: 'Failed',
      });
    } else {
      console.log('[Route] Updating job as COMPLETED with final_result:', !!result.recommendation);
      await updateJobStatus(jobId, {
        status: 'completed',
        progress: 100,
        current_step: 'Completed',
        tools_called: result.toolCalls,
        initial_analysis: result.initialAnalysis || undefined,
        critique: result.critique || undefined,
        final_result: result.recommendation || undefined,
      });
      console.log('[Route] Job update complete');

      // Save prediction for backtesting (get user_id from job)
      if (result.recommendation) {
        console.log('[Route] Attempting to save prediction for backtesting...', {
          symbol: result.recommendation.symbol,
          type: result.recommendation.analysis_type,
          recommendation: result.recommendation.recommendation,
          hasEntryPrice: !!result.recommendation.entry_price,
          hasStopLoss: !!result.recommendation.stop_loss,
          hasPriceTarget: !!result.recommendation.price_target,
          hasCurrentPrice: !!result.recommendation.current_price,
        });

        try {
          const adminClient = createAdminClient();
          const { data: job } = await adminClient
            .from('trading_analysis_jobs')
            .select('user_id')
            .eq('id', jobId)
            .single();

          if (job?.user_id) {
            const savedRecord = await savePrediction(jobId, job.user_id, result.recommendation);
            if (savedRecord) {
              console.log('[Route] Successfully saved prediction:', savedRecord.id);
            } else {
              console.log('[Route] Prediction was not saved (likely wait/hold or missing prices)');
            }
          } else {
            console.error('[Route] No user_id found for job');
          }
        } catch (backTestError) {
          console.error('[Route] Failed to save prediction:', backTestError);
          // Don't fail the job if backtest save fails
        }
      } else {
        console.log('[Route] No recommendation to save for backtesting');
      }
    }
  } catch (error) {
    console.error('Background analysis error:', error);
    await updateJobStatus(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      progress: 100,
      current_step: 'Failed',
    });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
