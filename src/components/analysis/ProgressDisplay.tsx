'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { AnalysisJob } from '@/types/analysis';

interface ProgressDisplayProps {
  job: AnalysisJob | null;
  isLoading: boolean;
}

export function ProgressDisplay({ job, isLoading }: ProgressDisplayProps) {
  if (isLoading && !job) {
    return (
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }

  if (!job) return null;

  const statusConfig = {
    pending: {
      color: 'bg-yellow-500',
      glow: 'shadow-yellow-500/20',
      label: 'Pending',
      icon: '⏳',
    },
    running: {
      color: 'bg-primary',
      glow: 'shadow-primary/20',
      label: 'Running',
      icon: '🔄',
    },
    completed: {
      color: 'bg-emerald-500',
      glow: 'shadow-emerald-500/20',
      label: 'Completed',
      icon: '✓',
    },
    failed: {
      color: 'bg-destructive',
      glow: 'shadow-destructive/20',
      label: 'Failed',
      icon: '✗',
    },
    cancelled: {
      color: 'bg-muted-foreground',
      glow: 'shadow-muted-foreground/20',
      label: 'Cancelled',
      icon: '⊘',
    },
  };

  const status = statusConfig[job.status];

  return (
    <div className="glass-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Analysis Progress</h3>
          <p className="text-sm text-muted-foreground">
            Analyzing {job.symbol}
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
            ${status.color}/10 text-foreground`}
        >
          <span
            className={`w-2 h-2 rounded-full ${status.color} ${
              job.status === 'running' ? 'animate-pulse' : ''
            }`}
          />
          {status.label}
        </div>
      </div>

      {/* Current Step */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {job.current_step || 'Initializing'}
          </span>
          <span className="text-sm font-mono text-primary">{job.progress}%</span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-3 w-full bg-muted/50 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${status.color} transition-all duration-700 ease-out rounded-full`}
            style={{ width: `${job.progress}%` }}
          />
          {job.status === 'running' && (
            <div
              className="absolute inset-y-0 left-0 animate-shimmer"
              style={{ width: `${job.progress}%` }}
            />
          )}
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Data Collection</span>
        <span>Analysis</span>
        <span>Critique</span>
        <span>Final</span>
      </div>

      {/* Error Display */}
      {job.error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <div className="flex items-start gap-3">
            <span className="text-destructive text-lg">!</span>
            <div className="space-y-1">
              <p className="font-medium text-destructive text-sm">Error occurred</p>
              <p className="text-xs text-muted-foreground">{job.error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
