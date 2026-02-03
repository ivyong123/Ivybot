'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnalysisJob } from '@/types/analysis';

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function TrendingUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function TrendingDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}

function MinusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function getRecommendationColor(rec: string) {
  switch (rec) {
    case 'strong_buy':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
    case 'buy':
      return 'bg-green-500/10 text-green-500 border-green-500/30';
    case 'hold':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
    case 'sell':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
    case 'strong_sell':
      return 'bg-red-500/10 text-red-500 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getRecommendationIcon(rec: string) {
  if (rec.includes('buy')) return TrendingUpIcon;
  if (rec.includes('sell')) return TrendingDownIcon;
  return MinusIcon;
}

export function AnalysisHistory() {
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/history?limit=${limit}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [offset]);

  const handleDownload = async (jobId: string) => {
    window.open(`/api/export?jobId=${jobId}`, '_blank');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold gradient-text">Analysis History</h1>
          <p className="text-muted-foreground">
            View and download your past trading analyses
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchHistory}
          className="gap-2 rounded-xl glass-subtle"
        >
          <RefreshIcon className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* History List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-6 w-24 bg-muted rounded" />
                    <div className="h-4 w-48 bg-muted rounded" />
                  </div>
                  <div className="h-10 w-10 bg-muted rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="p-4 rounded-2xl bg-primary/10 w-fit mx-auto mb-4">
              <ClockIcon className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Analysis History</h3>
            <p className="text-muted-foreground">
              Run your first analysis to see it here.
            </p>
          </div>
        ) : (
          jobs.map((job) => {
            const result = job.final_result;
            const RecommendationIcon = result
              ? getRecommendationIcon(result.recommendation)
              : MinusIcon;

            return (
              <div
                key={job.id}
                className="glass-card p-6 hover:glow-primary transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Symbol Badge */}
                    <div className="p-3 rounded-xl bg-primary/10">
                      <span className="text-lg font-bold text-primary">
                        {job.symbol}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize">
                          {job.analysis_type}
                        </Badge>
                        {result && (
                          <Badge
                            variant="outline"
                            className={getRecommendationColor(result.recommendation)}
                          >
                            <RecommendationIcon className="h-3 w-3 mr-1" />
                            {result.recommendation.replace('_', ' ').toUpperCase()}
                          </Badge>
                        )}
                        {job.status === 'completed' && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          >
                            Completed
                          </Badge>
                        )}
                        {job.status === 'failed' && (
                          <Badge
                            variant="outline"
                            className="bg-red-500/10 text-red-500 border-red-500/30"
                          >
                            Failed
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {formatDate(job.created_at)}
                        </span>
                        {result && (
                          <>
                            <span>Confidence: {result.confidence}%</span>
                            {result.price_target && (
                              <span>Target: ${result.price_target}</span>
                            )}
                          </>
                        )}
                      </div>

                      {result?.reasoning && (
                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-2xl">
                          {result.reasoning}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {job.status === 'completed' && result && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(job.id)}
                      className="gap-2 rounded-xl glass-subtle shrink-0"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Export
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="rounded-xl"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </span>
          <Button
            variant="outline"
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="rounded-xl"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
