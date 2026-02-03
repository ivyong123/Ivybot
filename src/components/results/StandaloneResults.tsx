'use client';

import ReactMarkdown from 'react-markdown';

interface StandaloneResult {
  symbol: string;
  type: string;
  data: Record<string, unknown>;
  summary: string;
  error?: string;
  generated_at: string;
}

interface StandaloneResultsProps {
  result: StandaloneResult;
}

export function StandaloneResults({ result }: StandaloneResultsProps) {
  const typeLabels: Record<string, { title: string; icon: string; color: string }> = {
    technical: { title: 'Technical Analysis', icon: 'chart', color: 'text-purple-500' },
    fundamentals: { title: 'Fundamentals', icon: 'target', color: 'text-orange-500' },
    earnings: { title: 'Earnings', icon: 'calendar', color: 'text-pink-500' },
    news: { title: 'News & Sentiment', icon: 'newspaper', color: 'text-teal-500' },
    smart_money: { title: 'Smart Money', icon: 'waves', color: 'text-indigo-500' },
  };

  const typeInfo = typeLabels[result.type] || { title: result.type, icon: 'info', color: 'text-primary' };

  return (
    <div className="space-y-6">
      {/* Error Warning if applicable */}
      {result.error && (
        <div className="glass-card p-4 border-amber-500/50 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <WarningIcon className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-amber-500">Partial Data</p>
              <p className="text-sm text-muted-foreground">{result.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Summary Card */}
        <div className="glass-card p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-primary/10 ${typeInfo.color}`}>
              <BrainIcon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">AI Summary</h2>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{result.summary}</ReactMarkdown>
          </div>
        </div>

        {/* Data Display Card */}
        <div className="glass-card p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${typeInfo.color}`}>
                <DatabaseIcon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">Raw Data</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Generated: {new Date(result.generated_at).toLocaleString()}
            </span>
          </div>

          <div className="space-y-4">
            {renderDataByType(result.type, result.data)}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderDataByType(type: string, data: Record<string, unknown>) {
  switch (type) {
    case 'technical':
      return <TechnicalDataDisplay data={data} />;
    case 'fundamentals':
      return <FundamentalsDataDisplay data={data} />;
    case 'earnings':
      return <EarningsDataDisplay data={data} />;
    case 'news':
      return <NewsDataDisplay data={data} />;
    case 'smart_money':
      return <SmartMoneyDataDisplay data={data} />;
    default:
      return <GenericDataDisplay data={data} />;
  }
}

function TechnicalDataDisplay({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <DataCard label="Current Price" value={`$${(data.current_price as number)?.toFixed(2) || 'N/A'}`} />
      <DataCard label="RSI (14)" value={(data.rsi_14 as number)?.toFixed(1) || 'N/A'} highlight={getRSIColor(data.rsi_14 as number)} />
      <DataCard label="Trend" value={(data.trend as string)?.toUpperCase() || 'N/A'} highlight={getTrendColor(data.trend as string)} />
      <DataCard label="SMA 20" value={`$${(data.sma_20 as number)?.toFixed(2) || 'N/A'}`} />
      <DataCard label="SMA 50" value={`$${(data.sma_50 as number)?.toFixed(2) || 'N/A'}`} />
      <DataCard label="Price vs SMA20" value={(data.price_vs_sma20 as string)?.toUpperCase() || 'N/A'} />
      <DataCard label="Support" value={`$${(data.support_level as number)?.toFixed(2) || 'N/A'}`} />
      <DataCard label="Resistance" value={`$${(data.resistance_level as number)?.toFixed(2) || 'N/A'}`} />
      <DataCard label="MACD" value={(data.macd as { macd: number })?.macd?.toFixed(2) || 'N/A'} />
    </div>
  );
}

function FundamentalsDataDisplay({ data }: { data: Record<string, unknown> }) {
  const recentRatings = (data.recent_ratings as Array<{ analyst: string; rating: string; target: number; date: string }>) || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <DataCard label="Consensus" value={(data.consensus as string)?.toUpperCase() || 'N/A'} highlight={getConsensusColor(data.consensus as string)} />
        <DataCard label="Avg Target" value={`$${(data.average_target as number)?.toFixed(2) || 'N/A'}`} />
        <DataCard label="High Target" value={`$${(data.high_target as number)?.toFixed(2) || 'N/A'}`} />
        <DataCard label="Low Target" value={`$${(data.low_target as number)?.toFixed(2) || 'N/A'}`} />
      </div>

      {recentRatings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Recent Analyst Ratings</h3>
          <div className="space-y-2">
            {recentRatings.map((rating, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm">{rating.analyst}</span>
                <span className={`text-sm font-medium ${getConsensusColor(rating.rating)}`}>{rating.rating}</span>
                <span className="text-sm">${rating.target}</span>
                <span className="text-xs text-muted-foreground">{rating.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EarningsDataDisplay({ data }: { data: Record<string, unknown> }) {
  const recentHistory = (data.recent_history as Array<{ date: string; eps_actual: number; eps_estimate: number; surprise: number }>) || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <DataCard label="Next Earnings" value={(data.next_earnings_date as string) || 'N/A'} />
        <DataCard label="Days Until" value={data.days_until_earnings !== null ? `${data.days_until_earnings} days` : 'N/A'} />
        <DataCard label="EPS Estimate" value={data.eps_estimate !== null ? `$${(data.eps_estimate as number)?.toFixed(2)}` : 'N/A'} />
      </div>

      {recentHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Recent Earnings History</h3>
          <div className="space-y-2">
            {recentHistory.map((earning, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm">{earning.date}</span>
                <span className="text-sm">EPS: ${earning.eps_actual?.toFixed(2)} vs ${earning.eps_estimate?.toFixed(2)}</span>
                <span className={`text-sm font-medium ${earning.surprise > 0 ? 'text-emerald-500' : earning.surprise < 0 ? 'text-red-500' : ''}`}>
                  {earning.surprise > 0 ? '+' : ''}{earning.surprise?.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewsDataDisplay({ data }: { data: Record<string, unknown> }) {
  const headlines = (data.top_headlines as Array<{ title: string; source: string; sentiment: string; date: string; url?: string }>) || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <DataCard label="Overall Sentiment" value={(data.overall_sentiment as string)?.toUpperCase() || 'N/A'} highlight={getSentimentColor(data.overall_sentiment as string)} />
        <DataCard label="Articles Analyzed" value={String(data.article_count || 0)} />
        <DataCard label="Bullish" value={String(data.bullish_count || 0)} highlight="text-emerald-500" />
        <DataCard label="Bearish" value={String(data.bearish_count || 0)} highlight="text-red-500" />
      </div>

      {headlines.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Top Headlines</h3>
          <div className="space-y-2">
            {headlines.map((headline, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-1">
                {headline.url ? (
                  <a
                    href={headline.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {headline.title}
                  </a>
                ) : (
                  <p className="text-sm font-medium">{headline.title}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{headline.source}</span>
                  <span className={getSentimentColor(headline.sentiment)}>{headline.sentiment}</span>
                  {headline.url && (
                    <a
                      href={headline.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <LinkIcon className="h-3 w-3" />
                      Read
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SmartMoneyDataDisplay({ data }: { data: Record<string, unknown> }) {
  const optionsFlow = data.options_flow as Record<string, unknown> | null;
  const insiderTrading = data.insider_trading as Record<string, unknown> | null;
  const institutional = data.institutional as Record<string, unknown> | null;
  const unusualWhalesError = data.unusual_whales_error as string | null;

  return (
    <div className="space-y-6">
      {/* Options Flow Section */}
      {optionsFlow !== null && optionsFlow !== undefined && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Options Flow (Unusual Whales)
          </h3>
          <div className="grid gap-4 md:grid-cols-4">
            <DataCard label="Sentiment" value={(optionsFlow.overall_sentiment as string)?.toUpperCase() || 'N/A'} highlight={getSentimentColor(optionsFlow.overall_sentiment as string)} />
            <DataCard label="Call Premium" value={`$${((optionsFlow.total_call_premium as number) / 1000000)?.toFixed(2)}M`} />
            <DataCard label="Put Premium" value={`$${((optionsFlow.total_put_premium as number) / 1000000)?.toFixed(2)}M`} />
            <DataCard label="Call/Put Ratio" value={(optionsFlow.call_put_ratio as number)?.toFixed(2) || 'N/A'} />
          </div>
        </div>
      )}

      {!optionsFlow && unusualWhalesError && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm text-amber-500">Options Flow: {unusualWhalesError}</p>
        </div>
      )}

      {/* Insider Trading Section */}
      {insiderTrading !== null && insiderTrading !== undefined && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Insider Trading (SEC Form 4)
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <DataCard label="Sentiment" value={(insiderTrading.sentiment as string)?.toUpperCase() || 'N/A'} highlight={getSentimentColor(insiderTrading.sentiment as string)} />
            <DataCard label="Total Buys" value={String(insiderTrading.total_buys || 0)} highlight="text-emerald-500" />
            <DataCard label="Total Sells" value={String(insiderTrading.total_sells || 0)} highlight="text-red-500" />
          </div>
        </div>
      )}

      {/* Institutional Section */}
      {institutional !== null && institutional !== undefined && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Institutional Holdings (SEC 13F)
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <DataCard label="Institutions" value={String(institutional.total_institutions || 0)} />
            <DataCard label="Trend" value={(institutional.sentiment as string)?.toUpperCase() || 'N/A'} highlight={getSentimentColor(institutional.sentiment as string)} />
          </div>
        </div>
      )}
    </div>
  );
}

function GenericDataDisplay({ data }: { data: Record<string, unknown> }) {
  return (
    <pre className="text-xs bg-muted/30 p-4 rounded-lg overflow-auto max-h-96">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function DataCard({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/30">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-semibold ${highlight || ''}`}>{value}</p>
    </div>
  );
}

// Helper functions for colors
function getRSIColor(rsi: number): string {
  if (rsi >= 70) return 'text-red-500';
  if (rsi <= 30) return 'text-emerald-500';
  return '';
}

function getTrendColor(trend: string): string {
  if (trend === 'uptrend') return 'text-emerald-500';
  if (trend === 'downtrend') return 'text-red-500';
  return 'text-amber-500';
}

function getConsensusColor(consensus: string): string {
  const lower = consensus?.toLowerCase() || '';
  if (lower.includes('buy') || lower === 'outperform') return 'text-emerald-500';
  if (lower.includes('sell') || lower === 'underperform') return 'text-red-500';
  return 'text-amber-500';
}

function getSentimentColor(sentiment: string): string {
  const lower = sentiment?.toLowerCase() || '';
  if (lower === 'bullish' || lower === 'positive' || lower === 'accumulating') return 'text-emerald-500';
  if (lower === 'bearish' || lower === 'negative' || lower === 'distributing') return 'text-red-500';
  return 'text-amber-500';
}

// Icons
function BrainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    </svg>
  );
}

function DatabaseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

function LinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function WarningIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
