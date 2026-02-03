'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DiagnosticResult {
  name: string;
  status: 'ok' | 'error' | 'warning';
  message: string;
  details?: string;
}

interface DiagnosticsResponse {
  overall: 'healthy' | 'degraded' | 'partial';
  results: DiagnosticResult[];
  summary: {
    ok: number;
    warnings: number;
    errors: number;
  };
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function XCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
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

function ServerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'ok':
      return <CheckIcon className="h-5 w-5 text-emerald-500" />;
    case 'warning':
      return <AlertIcon className="h-5 w-5 text-yellow-500" />;
    case 'error':
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    default:
      return null;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ok':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
    case 'warning':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
    case 'error':
      return 'bg-red-500/10 text-red-500 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function DiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/diagnostics');
      if (!response.ok) {
        throw new Error('Failed to run diagnostics');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold gradient-text">System Diagnostics</h1>
          <p className="text-muted-foreground">
            Check the status of all backend services and API connections
          </p>
        </div>
        <Button
          onClick={runDiagnostics}
          disabled={loading}
          className="gap-2 rounded-xl"
        >
          <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Checking...' : 'Run Diagnostics'}
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="glass-card p-6 border-red-500/30 bg-red-500/5">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {/* Overall Status */}
      {data && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-xl ${
              data.overall === 'healthy'
                ? 'bg-emerald-500/10'
                : data.overall === 'degraded'
                ? 'bg-red-500/10'
                : 'bg-yellow-500/10'
            }`}>
              <ServerIcon className={`h-8 w-8 ${
                data.overall === 'healthy'
                  ? 'text-emerald-500'
                  : data.overall === 'degraded'
                  ? 'text-red-500'
                  : 'text-yellow-500'
              }`} />
            </div>
            <div>
              <h2 className="text-2xl font-bold capitalize">
                System {data.overall === 'healthy' ? 'Healthy' : data.overall === 'degraded' ? 'Degraded' : 'Partially Working'}
              </h2>
              <div className="flex items-center gap-4 mt-1 text-sm">
                <span className="text-emerald-500">{data.summary.ok} OK</span>
                <span className="text-yellow-500">{data.summary.warnings} Warnings</span>
                <span className="text-red-500">{data.summary.errors} Errors</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Services */}
      {data && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Service Status</h3>
          <div className="grid gap-4">
            {data.results.map((result) => (
              <div
                key={result.name}
                className="glass-card p-4 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${getStatusColor(result.status)}`}>
                    {getStatusIcon(result.status)}
                  </div>
                  <div>
                    <h4 className="font-semibold">{result.name}</h4>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                    {result.details && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {result.details}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={getStatusColor(result.status)}>
                  {result.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Mapping */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4">Feature to Service Mapping</h3>
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-4 p-4 rounded-xl glass-subtle">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckIcon className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h4 className="font-semibold">Real-Time Data</h4>
              <p className="text-muted-foreground">
                Requires: <span className="font-mono">Polygon.io</span> (prices, OHLCV) + <span className="font-mono">Finnhub</span> (options chains)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-xl glass-subtle">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CheckIcon className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h4 className="font-semibold">Smart Money Flow</h4>
              <p className="text-muted-foreground">
                Requires: <span className="font-mono">Unusual Whales</span> (paid subscription required for full access)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-xl glass-subtle">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">AI Analysis</h4>
              <p className="text-muted-foreground">
                Requires: <span className="font-mono">OpenRouter</span> (AI) + <span className="font-mono">Supabase</span> (knowledge base)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4">Troubleshooting</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">API Key Issues:</strong> Check your <code className="bg-muted px-1 rounded">.env.local</code> file has all required API keys.
          </p>
          <p>
            <strong className="text-foreground">Polygon Free Tier:</strong> Real-time snapshots require a paid plan. Historical data works on free tier.
          </p>
          <p>
            <strong className="text-foreground">Unusual Whales:</strong> Requires a paid subscription ($49/month) for full API access.
          </p>
          <p>
            <strong className="text-foreground">Empty Knowledge Base:</strong> You need to populate the Supabase <code className="bg-muted px-1 rounded">documents</code> table with trading content.
          </p>
        </div>
      </div>
    </div>
  );
}
