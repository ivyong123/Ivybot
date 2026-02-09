'use client';

import { useState, useEffect } from 'react';
import { ActionSelector } from '@/components/analysis/ActionSelector';
import { TickerInput } from '@/components/analysis/TickerInput';
import { ProgressDisplay } from '@/components/analysis/ProgressDisplay';
import { AgentProgress } from '@/components/analysis/AgentProgress';
import { StrategyResults } from '@/components/results/StrategyResults';
import { StandaloneResults } from '@/components/results/StandaloneResults';
import { AnalysisType, AnalysisJob, isStandaloneAnalysis } from '@/types/analysis';
import { toast } from 'sonner';

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function ZapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

interface StandaloneResult {
  symbol: string;
  type: string;
  data: Record<string, unknown>;
  summary: string;
  error?: string;
  generated_at: string;
}

export function AnalysisDashboard() {
  const [analysisType, setAnalysisType] = useState<AnalysisType>('stock');
  const [currentJob, setCurrentJob] = useState<AnalysisJob | null>(null);
  const [standaloneResult, setStandaloneResult] = useState<StandaloneResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Poll for job updates (only for full analysis)
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed' || currentJob.status === 'cancelled') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/analyze/${currentJob.id}`);
        if (response.ok) {
          const job = await response.json();
          console.log('[Dashboard] Poll result:', {
            status: job.status,
            progress: job.progress,
            hasFinalResult: !!job.final_result,
            finalResultSymbol: job.final_result?.symbol,
          });
          setCurrentJob(job);

          if (job.status === 'completed') {
            console.log('[Dashboard] Job completed, final_result:', job.final_result);
            toast.success('Analysis complete!');
          } else if (job.status === 'failed') {
            toast.error('Analysis failed: ' + (job.error || 'Unknown error'));
          }
        }
      } catch (error) {
        console.error('Failed to poll job:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentJob]);

  const handleSubmit = async (symbol: string, context?: string) => {
    setIsLoading(true);
    setCurrentJob(null);
    setStandaloneResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          analysis_type: analysisType,
          additional_context: context,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start analysis');
      }

      const data = await response.json();

      // Check if this is a standalone result (returned immediately)
      if (data.standalone_result) {
        setStandaloneResult(data.standalone_result);
        toast.success(`${symbol.toUpperCase()} data loaded`);
      } else {
        // Full analysis - set up job polling
        setCurrentJob({
          id: data.job_id,
          user_id: '',
          symbol: symbol.toUpperCase(),
          analysis_type: analysisType,
          status: 'pending',
          progress: 0,
          current_step: 'Initializing',
          tools_called: [],
          initial_analysis: null,
          critique: null,
          final_result: null,
          error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        toast.success('Analysis started for ' + symbol.toUpperCase());
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    setCurrentJob(null);
    setStandaloneResult(null);
  };

  // Show standalone results
  if (standaloneResult) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            {standaloneResult.symbol} - {standaloneResult.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h1>
          <button
            onClick={handleNewAnalysis}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary hover:bg-primary/10 transition-all"
          >
            <SparklesIcon className="h-4 w-4" />
            New Lookup
          </button>
        </div>
        <StandaloneResults result={standaloneResult} />
      </div>
    );
  }

  // Show full analysis results if completed
  if (currentJob?.status === 'completed' && currentJob.final_result) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Analysis Results</h1>
          <button
            onClick={handleNewAnalysis}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary hover:bg-primary/10 transition-all"
          >
            <SparklesIcon className="h-4 w-4" />
            New Analysis
          </button>
        </div>
        <StrategyResults recommendation={currentJob.final_result} jobId={currentJob.id} />
      </div>
    );
  }

  // Show progress if running
  if (currentJob && (currentJob.status === 'pending' || currentJob.status === 'running')) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Analyzing {currentJob.symbol}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold gradient-text">
            AI Analysis in Progress
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Our AI is gathering real-time market data and analyzing multiple factors
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2 max-w-5xl mx-auto">
          <ProgressDisplay job={currentJob} isLoading={isLoading} />
          <AgentProgress toolCalls={currentJob.tools_called} />
        </div>
      </div>
    );
  }

  // Show input form
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium">
          <SparklesIcon className="h-4 w-4 text-primary" />
          <span>AI-Powered Trading Analysis</span>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight">
          <span className="gradient-text">Smart Money</span>
          <br />
          <span className="text-foreground">Insights</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Get institutional-grade analysis with real-time market data,
          options flow, and AI-powered trade recommendations.
        </p>
      </div>

      {/* Analysis Type Selection */}
      <div className="glass-card p-8 space-y-8">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Select Analysis Type</h2>
          <p className="text-sm text-muted-foreground">
            Choose full analysis for trade recommendations, or quick lookup for specific data
          </p>
        </div>
        <ActionSelector selected={analysisType} onSelect={setAnalysisType} />

        {/* Standalone indicator */}
        {isStandaloneAnalysis(analysisType) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
            <ZapIcon className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              Quick lookup - Returns data summary without trading predictions
            </span>
          </div>
        )}

        {/* Ticker Input */}
        <div className="pt-4 border-t border-border/50">
          <TickerInput
            analysisType={analysisType}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Error State */}
      {currentJob?.status === 'failed' && (
        <div className="glass-card p-6 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-destructive/10">
              <span className="text-destructive text-xl">!</span>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-destructive">Analysis Failed</p>
              <p className="text-sm text-muted-foreground">{currentJob.error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
