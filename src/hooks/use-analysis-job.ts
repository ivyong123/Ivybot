'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnalysisJob } from '@/types/analysis';

interface UseAnalysisJobOptions {
  pollInterval?: number;
  onComplete?: (job: AnalysisJob) => void;
  onError?: (error: string) => void;
}

interface UseAnalysisJobReturn {
  job: AnalysisJob | null;
  isLoading: boolean;
  error: string | null;
  startPolling: (jobId: string) => void;
  stopPolling: () => void;
  refresh: () => Promise<void>;
}

export function useAnalysisJob(options: UseAnalysisJobOptions = {}): UseAnalysisJobReturn {
  const { pollInterval = 2000, onComplete, onError } = options;

  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/analyze/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch job');
      }

      const jobData = await response.json();
      setJob(jobData);
      setError(null);

      // Check if job is complete
      if (jobData.status === 'completed') {
        onComplete?.(jobData);
      } else if (jobData.status === 'failed') {
        onError?.(jobData.error || 'Analysis failed');
      }

      return jobData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    }
  }, [onComplete, onError]);

  const startPolling = useCallback((id: string) => {
    setJobId(id);
    setIsLoading(true);
    setError(null);
  }, []);

  const stopPolling = useCallback(() => {
    setJobId(null);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    if (jobId) {
      await fetchJob(jobId);
    }
  }, [jobId, fetchJob]);

  // Polling effect
  useEffect(() => {
    if (!jobId) return;

    // Initial fetch
    fetchJob(jobId);

    // Set up polling
    const interval = setInterval(async () => {
      const currentJob = await fetchJob(jobId);

      // Stop polling if job is complete
      if (currentJob && (
        currentJob.status === 'completed' ||
        currentJob.status === 'failed' ||
        currentJob.status === 'cancelled'
      )) {
        setIsLoading(false);
        clearInterval(interval);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [jobId, pollInterval, fetchJob]);

  return {
    job,
    isLoading,
    error,
    startPolling,
    stopPolling,
    refresh,
  };
}
