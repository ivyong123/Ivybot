'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnalysisType, AnalysisJob, CreateAnalysisRequest } from '@/types/analysis';

interface AnalysisContextValue {
  currentJob: AnalysisJob | null;
  analysisType: AnalysisType;
  isLoading: boolean;
  error: string | null;
  setAnalysisType: (type: AnalysisType) => void;
  startAnalysis: (request: CreateAnalysisRequest) => Promise<string | null>;
  setCurrentJob: (job: AnalysisJob | null) => void;
  clearError: () => void;
  reset: () => void;
}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(undefined);

interface AnalysisProviderProps {
  children: ReactNode;
}

export function AnalysisProvider({ children }: AnalysisProviderProps) {
  const [currentJob, setCurrentJob] = useState<AnalysisJob | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>('stock');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = useCallback(async (request: CreateAnalysisRequest): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start analysis');
      }

      const data = await response.json();

      // Set initial job state
      setCurrentJob({
        id: data.job_id,
        user_id: '',
        symbol: request.symbol.toUpperCase(),
        analysis_type: request.analysis_type,
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

      return data.job_id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setCurrentJob(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        currentJob,
        analysisType,
        isLoading,
        error,
        setAnalysisType,
        startAnalysis,
        setCurrentJob,
        clearError,
        reset,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}
