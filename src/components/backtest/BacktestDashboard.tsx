'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BacktestSummary, BacktestRecord } from '@/types/backtest';
import { toast } from 'sonner';

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

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

// Filter types
type AssetType = 'all' | 'stock' | 'forex';
type StatusFilter = 'all' | 'pending' | 'won' | 'lost' | 'expired' | 'partial';
type DaysFilter = 7 | 30 | 90 | 365 | 0; // 0 = all time

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function FilterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function BacktestDashboard() {
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [symbols, setSymbols] = useState<string[]>([]);

  // Filter states
  const [daysFilter, setDaysFilter] = useState<DaysFilter>(0);
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetType>('all');
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Build query string from filters
  const buildQueryString = (refresh = false) => {
    const params = new URLSearchParams();
    if (refresh) params.set('refresh', 'true');
    if (daysFilter > 0) params.set('days', daysFilter.toString());
    if (assetTypeFilter !== 'all') params.set('assetType', assetTypeFilter);
    if (symbolFilter) params.set('symbol', symbolFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  };

  const fetchData = async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      const response = await fetch(`/api/backtest${buildQueryString(refresh)}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
        if (refresh) toast.success('Predictions updated');
      }
    } catch (error) {
      console.error('Failed to fetch backtest data:', error);
      toast.error('Failed to load backtest data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchSymbols = async () => {
    try {
      const response = await fetch('/api/backtest?symbols=true');
      if (response.ok) {
        const data = await response.json();
        setSymbols(data.symbols || []);
      }
    } catch (error) {
      console.error('Failed to fetch symbols:', error);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await fetch(`/api/backtest/export${buildQueryString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backtest-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Report downloaded');
      } else {
        toast.error('Failed to export report');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const applyFilters = () => {
    fetchData();
  };

  const clearFilters = () => {
    setDaysFilter(0);
    setAssetTypeFilter('all');
    setSymbolFilter('');
    setStatusFilter('all');
  };

  useEffect(() => {
    fetchData();
    fetchSymbols();
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    fetchData();
  }, [daysFilter, assetTypeFilter, symbolFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <TargetIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Backtest Data</h3>
        <p className="text-muted-foreground">Run some analyses to start tracking predictions</p>
      </div>
    );
  }

  const { stats, recent_trades, by_symbol, monthly_performance } = summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Backtest Performance</h1>
          <p className="text-muted-foreground">Track the accuracy of AI predictions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <FilterIcon className="h-4 w-4" />
            Filters
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="gap-2"
          >
            <DownloadIcon className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Time Period */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Time Period</label>
              <select
                value={daysFilter}
                onChange={(e) => setDaysFilter(Number(e.target.value) as DaysFilter)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              >
                <option value={0}>All Time</option>
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
                <option value={365}>Last Year</option>
              </select>
            </div>

            {/* Asset Type */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Asset Type</label>
              <select
                value={assetTypeFilter}
                onChange={(e) => setAssetTypeFilter(e.target.value as AssetType)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              >
                <option value="all">All Types</option>
                <option value="stock">Stocks</option>
                <option value="forex">Forex</option>
              </select>
            </div>

            {/* Symbol - Text input with datalist for suggestions */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Symbol</label>
              <input
                type="text"
                list="symbol-suggestions"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value.toUpperCase())}
                placeholder="e.g., AAPL, EUR/USD"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
              <datalist id="symbol-suggestions">
                {symbols.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="partial">Partial</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Win Rate */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Win Rate</span>
            <TargetIcon className="h-5 w-5 text-primary" />
          </div>
          <p className={`text-3xl font-bold ${stats.win_rate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
            {stats.win_rate.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.winning_trades}W / {stats.losing_trades}L / {stats.pending_trades}P
          </p>
        </div>

        {/* Profit Factor */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Profit Factor</span>
            <TrendingUpIcon className="h-5 w-5 text-emerald-500" />
          </div>
          <p className={`text-3xl font-bold ${stats.profit_factor >= 1 ? 'text-emerald-500' : 'text-red-500'}`}>
            {stats.profit_factor.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Avg Win: +{stats.avg_win_percent.toFixed(1)}% | Avg Loss: -{stats.avg_loss_percent.toFixed(1)}%
          </p>
        </div>

        {/* Total Trades */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Trades</span>
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-3xl font-bold">{stats.total_trades}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Avg Duration: {stats.avg_trade_duration_days.toFixed(1)} days
          </p>
        </div>

        {/* Recent Performance */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Last 10 Trades</span>
            <span className="text-2xl">🎯</span>
          </div>
          <p className={`text-3xl font-bold ${stats.last_10_trades_win_rate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
            {stats.last_10_trades_win_rate.toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            30-day: {stats.last_30_days_win_rate.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Direction Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5 text-emerald-500" />
            Bullish Predictions
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{stats.bullish_wins}/{stats.bullish_trades}</p>
              <p className="text-sm text-muted-foreground">Wins / Total</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${stats.bullish_trades > 0 && (stats.bullish_wins / stats.bullish_trades) >= 0.5 ? 'text-emerald-500' : 'text-red-500'}`}>
                {stats.bullish_trades > 0 ? ((stats.bullish_wins / stats.bullish_trades) * 100).toFixed(0) : 0}%
              </p>
              <p className="text-sm text-muted-foreground">Win Rate</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingDownIcon className="h-5 w-5 text-red-500" />
            Bearish Predictions
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{stats.bearish_wins}/{stats.bearish_trades}</p>
              <p className="text-sm text-muted-foreground">Wins / Total</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${stats.bearish_trades > 0 && (stats.bearish_wins / stats.bearish_trades) >= 0.5 ? 'text-emerald-500' : 'text-red-500'}`}>
                {stats.bearish_trades > 0 ? ((stats.bearish_wins / stats.bearish_trades) * 100).toFixed(0) : 0}%
              </p>
              <p className="text-sm text-muted-foreground">Win Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Analysis */}
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4">Confidence Level Analysis</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm text-muted-foreground mb-1">High Confidence (&gt;70%)</p>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold">{stats.high_confidence_wins}/{stats.high_confidence_trades}</span>
              <span className={`text-xl font-bold ${stats.high_confidence_trades > 0 && (stats.high_confidence_wins / stats.high_confidence_trades) >= 0.5 ? 'text-emerald-500' : 'text-red-500'}`}>
                {stats.high_confidence_trades > 0 ? ((stats.high_confidence_wins / stats.high_confidence_trades) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-sm text-muted-foreground mb-1">Low Confidence (&lt;70%)</p>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold">{stats.low_confidence_wins}/{stats.low_confidence_trades}</span>
              <span className={`text-xl font-bold ${stats.low_confidence_trades > 0 && (stats.low_confidence_wins / stats.low_confidence_trades) >= 0.5 ? 'text-emerald-500' : 'text-red-500'}`}>
                {stats.low_confidence_trades > 0 ? ((stats.low_confidence_wins / stats.low_confidence_trades) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Best/Worst */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-2 text-emerald-500">Best Trade</h3>
          <p className="text-2xl font-bold text-emerald-500">+{stats.best_trade_percent.toFixed(2)}%</p>
          <p className="text-sm text-muted-foreground">Best Symbol: {stats.best_symbol}</p>
        </div>
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-2 text-red-500">Worst Trade</h3>
          <p className="text-2xl font-bold text-red-500">{stats.worst_trade_percent.toFixed(2)}%</p>
          <p className="text-sm text-muted-foreground">Worst Symbol: {stats.worst_symbol}</p>
        </div>
      </div>

      {/* Symbol Performance */}
      {Object.keys(by_symbol).length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Performance by Symbol</h3>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
            {Object.entries(by_symbol)
              .sort((a, b) => b[1].win_rate - a[1].win_rate)
              .slice(0, 8)
              .map(([symbol, data]) => (
                <div key={symbol} className="p-3 rounded-lg glass-subtle">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold">{symbol}</span>
                    <Badge className={data.win_rate >= 50 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}>
                      {data.win_rate.toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.wins}W / {data.trades - data.wins}L
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      {recent_trades.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Recent Predictions</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recent_trades.slice(0, 20).map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade }: { trade: BacktestRecord }) {
  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-500',
    won: 'bg-emerald-500/20 text-emerald-500',
    lost: 'bg-red-500/20 text-red-500',
    partial: 'bg-blue-500/20 text-blue-500',
    expired: 'bg-gray-500/20 text-gray-500',
  };

  const directionIcon = trade.predicted_direction === 'bullish' ? '📈' : trade.predicted_direction === 'bearish' ? '📉' : '➡️';

  return (
    <div className="flex items-center justify-between p-3 rounded-lg glass-subtle">
      <div className="flex items-center gap-3">
        <span className="text-xl">{directionIcon}</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold">{trade.symbol}</span>
            <Badge variant="outline" className="text-xs">
              {trade.analysis_type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Entry: {trade.entry_price.toFixed(trade.analysis_type === 'forex' ? 5 : 2)} → Target: {trade.target_price.toFixed(trade.analysis_type === 'forex' ? 5 : 2)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <Badge className={statusColors[trade.status]}>
          {trade.status.toUpperCase()}
        </Badge>
        {trade.pnl_percent !== undefined && trade.pnl_percent !== null && (
          <p className={`text-sm font-mono mt-1 ${trade.pnl_percent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trade.pnl_percent >= 0 ? '+' : ''}{trade.pnl_percent.toFixed(2)}%
          </p>
        )}
      </div>
    </div>
  );
}
