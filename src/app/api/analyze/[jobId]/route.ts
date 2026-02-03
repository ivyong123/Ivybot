import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch job (RLS will ensure user can only see their own jobs)
    const { data: job, error: fetchError } = await supabase
      .from('trading_analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError) {
      console.error('[JobStatus] Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Job not found', details: fetchError.message },
        { status: 404 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Debug logging
    console.log('[JobStatus] Job data:', {
      id: job.id,
      status: job.status,
      progress: job.progress,
      has_final_result: !!job.final_result,
      final_result_type: typeof job.final_result,
      final_result_keys: job.final_result ? Object.keys(job.final_result) : null,
    });

    // Verify ownership
    if (job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: job.id,
      symbol: job.symbol,
      analysis_type: job.analysis_type,
      status: job.status,
      progress: job.progress,
      current_step: job.current_step,
      tools_called: job.tools_called,
      initial_analysis: job.initial_analysis,
      critique: job.critique,
      final_result: job.final_result,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  } catch (error) {
    console.error('Get job API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch job to verify ownership
    const { data: job, error: fetchError } = await supabase
      .from('trading_analysis_jobs')
      .select('user_id, status')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Only allow cancellation of pending/running jobs
    if (job.status !== 'pending' && job.status !== 'running') {
      return NextResponse.json(
        { error: 'Cannot cancel completed job' },
        { status: 400 }
      );
    }

    // Update status to cancelled
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from('trading_analysis_jobs')
      .update({
        status: 'cancelled',
        current_step: 'Cancelled by user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to cancel job:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel job' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Job cancelled' });
  } catch (error) {
    console.error('Delete job API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
