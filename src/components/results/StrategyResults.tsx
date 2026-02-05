'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TradeRecommendation, KeyFactor } from '@/types/analysis';

// Icon Components
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

function PauseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function RocketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function AlertTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function BarChart3Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
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

interface StrategyResultsProps {
  recommendation: TradeRecommendation;
  jobId?: string;
}

// Helper to format prices with proper precision
function formatPrice(price: number | null | undefined, symbol: string, isForex: boolean = false): string {
  // Handle null/undefined
  if (price == null || isNaN(price)) {
    return 'N/A';
  }

  // Check if it's a forex pair
  if (isForex || symbol.includes('/')) {
    // JPY pairs use 3 decimal places, others use 5
    const isJPY = symbol.toUpperCase().includes('JPY');
    const decimals = isJPY ? 3 : 5;
    return price.toFixed(decimals);
  }

  // Stocks - use 2 decimals for prices > $1, more for penny stocks
  if (price < 1) {
    return price.toFixed(4);
  }
  return price.toFixed(2);
}

// Get currency symbol based on asset type
function getCurrencyPrefix(symbol: string, isForex: boolean = false): string {
  if (isForex || symbol.includes('/')) {
    return ''; // No $ prefix for forex
  }
  return '$';
}

const recommendationConfig = {
  strong_buy: {
    color: 'bg-emerald-500',
    glow: 'glow-success',
    label: 'Strong Buy',
    Icon: RocketIcon,
    iconColor: 'text-emerald-500',
  },
  buy: {
    color: 'bg-emerald-400',
    glow: 'glow-success',
    label: 'Buy',
    Icon: TrendingUpIcon,
    iconColor: 'text-emerald-400',
  },
  hold: {
    color: 'bg-yellow-500',
    glow: 'glow-warning',
    label: 'Hold',
    Icon: PauseIcon,
    iconColor: 'text-yellow-500',
  },
  sell: {
    color: 'bg-red-400',
    glow: 'glow-destructive',
    label: 'Sell',
    Icon: TrendingDownIcon,
    iconColor: 'text-red-400',
  },
  strong_sell: {
    color: 'bg-red-500',
    glow: 'glow-destructive',
    label: 'Strong Sell',
    Icon: ChevronDownIcon,
    iconColor: 'text-red-500',
  },
  wait: {
    color: 'bg-gray-500',
    glow: 'glow-muted',
    label: 'Wait',
    Icon: PauseIcon,
    iconColor: 'text-gray-500',
  },
};

export function StrategyResults({ recommendation, jobId }: StrategyResultsProps) {
  // Defensive: ensure recommendation type is valid, default to 'hold'
  const recType = recommendation.recommendation in recommendationConfig
    ? recommendation.recommendation
    : 'hold';
  const config = recommendationConfig[recType];

  // Defensive: ensure key_factors is an array
  const keyFactors = Array.isArray(recommendation.key_factors) ? recommendation.key_factors : [];
  const bullishFactors = keyFactors.filter((f) => f.sentiment === 'bullish');
  const bearishFactors = keyFactors.filter((f) => f.sentiment === 'bearish');

  const isForex = recommendation.analysis_type === 'forex';
  const currencyPrefix = getCurrencyPrefix(recommendation.symbol, isForex);

  const handleDownload = () => {
    if (jobId) {
      window.open(`/api/export?jobId=${jobId}`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Recommendation Card */}
      <div className={`glass-card p-8 ${config.glow}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Symbol & Type */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-background/50 ${config.iconColor}`}>
                <config.Icon className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-baseline gap-3">
                  <h2 className="text-3xl font-bold">{recommendation.symbol}</h2>
                  {/* Show CURRENT market price (not entry price) */}
                  {recommendation.current_price && (
                    <span className="text-xl font-mono text-muted-foreground">
                      {currencyPrefix}{formatPrice(recommendation.current_price, recommendation.symbol, isForex)}
                    </span>
                  )}
                  {/* Fallback: For forex, show from forex_setup.currentPrice */}
                  {!recommendation.current_price && recommendation.forex_setup?.currentPrice && (
                    <span className="text-xl font-mono text-muted-foreground">
                      {formatPrice(recommendation.forex_setup.currentPrice, recommendation.symbol, true)}
                    </span>
                  )}
                  {/* Fallback: For stocks/options, show from stock_result.currentPrice */}
                  {!recommendation.current_price && !recommendation.forex_setup?.currentPrice && recommendation.stock_result?.currentPrice && (
                    <span className="text-xl font-mono text-muted-foreground">
                      {currencyPrefix}{formatPrice(recommendation.stock_result.currentPrice, recommendation.symbol, false)}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground capitalize">
                  {recommendation.analysis_type} Analysis
                </p>
              </div>
            </div>
          </div>

          {/* Recommendation Badge & Download */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex items-center gap-3">
              {jobId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-2 rounded-xl glass-subtle"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Export
                </Button>
              )}
              <div
                className={`px-6 py-3 rounded-2xl ${config.color} text-white font-bold text-xl`}
              >
                {config.label}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Confidence:</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${config.color} transition-all`}
                    style={{ width: `${recommendation.confidence}%` }}
                  />
                </div>
                <span className="font-mono font-bold">{recommendation.confidence}%</span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6 bg-border/50" />

        {/* Price Levels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendation.entry_price && (
            <div className="glass-subtle p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground mb-1">Entry Price</p>
              <p className="text-2xl font-bold font-mono">
                {currencyPrefix}{formatPrice(recommendation.entry_price, recommendation.symbol, isForex)}
              </p>
            </div>
          )}
          {recommendation.price_target && (
            <div className="p-4 rounded-xl text-center bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-emerald-500 mb-1">Target Price</p>
              <p className="text-2xl font-bold font-mono text-emerald-500">
                {currencyPrefix}{formatPrice(recommendation.price_target, recommendation.symbol, isForex)}
              </p>
            </div>
          )}
          {recommendation.stop_loss && (
            <div className="p-4 rounded-xl text-center bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-500 mb-1">Stop Loss</p>
              <p className="text-2xl font-bold font-mono text-red-500">
                {currencyPrefix}{formatPrice(recommendation.stop_loss, recommendation.symbol, isForex)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Summary</h3>
        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {recommendation.reasoning}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm font-medium">Timeframe:</span>
          <Badge variant="outline" className="rounded-lg">
            {recommendation.timeframe}
          </Badge>
        </div>
      </div>

      {/* Key Factors */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Bullish Factors */}
        {bullishFactors.length > 0 && (
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUpIcon className="h-5 w-5 text-emerald-500" />
              </div>
              <h3 className="font-semibold text-emerald-500">Bullish Factors</h3>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-0">
                {bullishFactors.length}
              </Badge>
            </div>
            <ul className="space-y-3">
              {bullishFactors.map((factor, index) => (
                <FactorItem key={index} factor={factor} type="bullish" />
              ))}
            </ul>
          </div>
        )}

        {/* Bearish Factors */}
        {bearishFactors.length > 0 && (
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDownIcon className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="font-semibold text-red-500">Bearish Factors</h3>
              <Badge className="bg-red-500/10 text-red-500 border-0">
                {bearishFactors.length}
              </Badge>
            </div>
            <ul className="space-y-3">
              {bearishFactors.map((factor, index) => (
                <FactorItem key={index} factor={factor} type="bearish" />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Risks */}
      {Array.isArray(recommendation.risks) && recommendation.risks.length > 0 && (
        <div className="glass-card p-6 border-red-500/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
            </div>
            <h3 className="font-semibold">Key Risks</h3>
            <Badge variant="destructive" className="rounded-lg">
              {recommendation.risks.length}
            </Badge>
          </div>
          <ul className="space-y-2">
            {recommendation.risks.map((risk, index) => (
              <li key={index} className="flex items-start gap-3 text-sm">
                <span className="text-red-500 mt-0.5">!</span>
                <span className="text-muted-foreground">{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Options Strategy */}
      {recommendation.options_strategy && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Options Strategy</h3>
            <Badge className="bg-primary/10 text-primary border-0 capitalize">
              {recommendation.options_strategy.strategy_type.replace(/_/g, ' ')}
            </Badge>
          </div>

          {/* Strategy Description */}
          {recommendation.options_strategy.strategy_description && (
            <p className="text-sm text-muted-foreground mb-4">
              {recommendation.options_strategy.strategy_description}
            </p>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {recommendation.options_strategy.max_profit != null && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-xs text-muted-foreground mb-1">Max Profit</p>
                <p className="text-lg font-bold font-mono text-emerald-500">
                  ${recommendation.options_strategy.max_profit.toFixed(0)}
                </p>
              </div>
            )}
            {recommendation.options_strategy.max_loss != null && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-xs text-muted-foreground mb-1">Max Loss</p>
                <p className="text-lg font-bold font-mono text-red-500">
                  ${recommendation.options_strategy.max_loss.toFixed(0)}
                </p>
              </div>
            )}
            {recommendation.options_strategy.risk_reward_ratio != null && (
              <div className="p-3 rounded-xl glass-subtle text-center">
                <p className="text-xs text-muted-foreground mb-1">Risk/Reward</p>
                <p className="text-lg font-bold font-mono">
                  {recommendation.options_strategy.risk_reward_ratio.toFixed(1)}:1
                </p>
              </div>
            )}
            {recommendation.options_strategy.probability_of_profit != null && (
              <div className="p-3 rounded-xl glass-subtle text-center">
                <p className="text-xs text-muted-foreground mb-1">Win Prob</p>
                <p className="text-lg font-bold font-mono">
                  {recommendation.options_strategy.probability_of_profit}%
                </p>
              </div>
            )}
          </div>

          {/* Days to Expiration & Net Cost */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            {recommendation.options_strategy.days_to_expiration != null && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Days to Exp:</span>
                <span className="font-bold">{recommendation.options_strategy.days_to_expiration}</span>
              </div>
            )}
            {recommendation.options_strategy.net_debit_credit != null && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Net Cost:</span>
                <span className={`font-bold ${recommendation.options_strategy.net_debit_credit > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {recommendation.options_strategy.net_debit_credit > 0 ? 'Debit' : 'Credit'} ${Math.abs(recommendation.options_strategy.net_debit_credit).toFixed(2)}
                </span>
              </div>
            )}
            {Array.isArray(recommendation.options_strategy.breakeven) && recommendation.options_strategy.breakeven.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Breakeven:</span>
                <span className="font-bold font-mono">
                  ${recommendation.options_strategy.breakeven.map(b => b?.toFixed(2) ?? '0').join(' / $')}
                </span>
              </div>
            )}
          </div>

          {/* Strategy Legs with Greeks */}
          {Array.isArray(recommendation.options_strategy.legs) && recommendation.options_strategy.legs.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Strategy Legs</p>
              {recommendation.options_strategy.legs.map((leg, index) => (
                <div key={index} className="p-4 rounded-xl glass-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`capitalize font-medium ${leg.action === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {leg.action.toUpperCase()} {leg.quantity}x {leg.option_type.toUpperCase()}
                    </span>
                    <span className="font-mono font-bold">
                      ${leg.strike} <span className="text-muted-foreground text-sm">exp {leg.expiration}</span>
                    </span>
                  </div>
                  {leg.premium != null && (
                    <div className="text-sm text-muted-foreground">
                      Premium: <span className="font-mono">${leg.premium.toFixed(2)}</span>
                    </div>
                  )}
                  {/* Greeks */}
                  {leg.greeks && (
                    <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50">
                      {leg.greeks.delta != null && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Δ Delta:</span>{' '}
                          <span className="font-mono font-medium">{leg.greeks.delta.toFixed(3)}</span>
                        </div>
                      )}
                      {leg.greeks.gamma != null && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Γ Gamma:</span>{' '}
                          <span className="font-mono font-medium">{leg.greeks.gamma.toFixed(4)}</span>
                        </div>
                      )}
                      {leg.greeks.theta != null && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Θ Theta:</span>{' '}
                          <span className={`font-mono font-medium ${leg.greeks.theta < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {leg.greeks.theta.toFixed(3)}
                          </span>
                        </div>
                      )}
                      {leg.greeks.vega != null && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">V Vega:</span>{' '}
                          <span className="font-mono font-medium">{leg.greeks.vega.toFixed(3)}</span>
                        </div>
                      )}
                      {leg.greeks.implied_volatility != null && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">IV:</span>{' '}
                          <span className="font-mono font-medium">{(leg.greeks.implied_volatility * 100).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Forex Setup - Comprehensive with Multiple TPs */}
      {recommendation.forex_setup && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <BarChart3Icon className="h-5 w-5 text-blue-500" />
            </div>
            <h3 className="font-semibold">Forex Trade Setup</h3>
            <Badge className={`border-0 ${recommendation.forex_setup.direction === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-500' : recommendation.forex_setup.direction === 'BEARISH' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
              {recommendation.forex_setup.trade?.action || recommendation.forex_setup.direction}
            </Badge>
          </div>

          {/* Price Levels with Multiple TPs */}
          {recommendation.forex_setup.trade && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl glass-subtle text-center">
                  <p className="text-xs text-muted-foreground mb-1">Entry</p>
                  <p className="text-lg font-bold font-mono">{formatPrice(recommendation.forex_setup.trade.entryPrice, recommendation.forex_setup.pair, true)}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stop Loss</p>
                  <p className="text-lg font-bold font-mono text-red-500">{formatPrice(recommendation.forex_setup.trade.stopLoss, recommendation.forex_setup.pair, true)}</p>
                  <p className="text-xs text-red-400">{recommendation.forex_setup.trade.stopLossPips?.toFixed(1) ?? '0'} pips</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs text-muted-foreground mb-1">TP1</p>
                  <p className="text-lg font-bold font-mono text-emerald-500">{formatPrice(recommendation.forex_setup.trade.takeProfit1, recommendation.forex_setup.pair, true)}</p>
                  <p className="text-xs text-emerald-400">{recommendation.forex_setup.trade.takeProfit1Pips?.toFixed(1) ?? '0'} pips</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs text-muted-foreground mb-1">TP2</p>
                  <p className="text-lg font-bold font-mono text-emerald-500">{formatPrice(recommendation.forex_setup.trade.takeProfit2, recommendation.forex_setup.pair, true)}</p>
                  <p className="text-xs text-emerald-400">{recommendation.forex_setup.trade.takeProfit2Pips?.toFixed(1) ?? '0'} pips</p>
                </div>
              </div>

              {/* TP3 and Risk/Reward */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs text-muted-foreground mb-1">TP3 (Runner)</p>
                  <p className="text-lg font-bold font-mono text-emerald-500">{formatPrice(recommendation.forex_setup.trade.takeProfit3, recommendation.forex_setup.pair, true)}</p>
                  <p className="text-xs text-emerald-400">{recommendation.forex_setup.trade.takeProfit3Pips?.toFixed(1) ?? '0'} pips</p>
                </div>
                <div className="p-3 rounded-xl glass-subtle text-center">
                  <p className="text-xs text-muted-foreground mb-1">Risk/Reward</p>
                  <p className="text-lg font-bold font-mono">{recommendation.forex_setup.trade.riskRewardRatio}</p>
                </div>
                <div className="p-3 rounded-xl glass-subtle text-center">
                  <p className="text-xs text-muted-foreground mb-1">Order Type</p>
                  <p className={`text-lg font-bold ${recommendation.forex_setup.trade.orderType?.includes('BUY') ? 'text-emerald-500' : recommendation.forex_setup.trade.orderType?.includes('SELL') ? 'text-red-500' : ''}`}>
                    {recommendation.forex_setup.trade.orderType?.replace('_', ' ') || 'MARKET'}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Risk Management */}
          {recommendation.forex_setup.riskManagement && (
            <div className="p-4 rounded-xl glass-subtle">
              <p className="text-sm font-medium text-muted-foreground mb-3">Risk Management</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Risk:</span>
                  <span className="ml-2 font-bold">{recommendation.forex_setup.riskManagement.riskPercent}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lot Size:</span>
                  <span className="ml-2 font-bold">{recommendation.forex_setup.riskManagement.suggestedLotSize}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Risk:</span>
                  <span className="ml-2 font-bold">${recommendation.forex_setup.riskManagement.maxRiskDollars}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pip Value:</span>
                  <span className="ml-2 font-bold">${recommendation.forex_setup.riskManagement.pipValue}</span>
                </div>
              </div>
              {recommendation.forex_setup.riskManagement.calculation && (
                <p className="text-xs text-muted-foreground mt-2">{recommendation.forex_setup.riskManagement.calculation}</p>
              )}
            </div>
          )}

          {/* Key Levels */}
          {recommendation.forex_setup.levels && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl glass-subtle">
                <p className="text-xs text-muted-foreground mb-2">Support Levels</p>
                <div className="space-y-1">
                  <p className="font-mono text-sm text-emerald-400">S1: {formatPrice(recommendation.forex_setup.levels.support1, recommendation.forex_setup.pair, true)}</p>
                  <p className="font-mono text-sm text-emerald-400">S2: {formatPrice(recommendation.forex_setup.levels.support2, recommendation.forex_setup.pair, true)}</p>
                  <p className="font-mono text-sm text-emerald-400">S3: {formatPrice(recommendation.forex_setup.levels.support3, recommendation.forex_setup.pair, true)}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl glass-subtle">
                <p className="text-xs text-muted-foreground mb-2">Resistance Levels</p>
                <div className="space-y-1">
                  <p className="font-mono text-sm text-red-400">R1: {formatPrice(recommendation.forex_setup.levels.resistance1, recommendation.forex_setup.pair, true)}</p>
                  <p className="font-mono text-sm text-red-400">R2: {formatPrice(recommendation.forex_setup.levels.resistance2, recommendation.forex_setup.pair, true)}</p>
                  <p className="font-mono text-sm text-red-400">R3: {formatPrice(recommendation.forex_setup.levels.resistance3, recommendation.forex_setup.pair, true)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Indicators */}
          {recommendation.forex_setup.indicators && (
            <div className="p-4 rounded-xl glass-subtle">
              <p className="text-sm font-medium text-muted-foreground mb-3">Technical Indicators</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {recommendation.forex_setup.indicators.rsi && (
                  <div>
                    <span className="text-muted-foreground">RSI:</span>
                    <span className="ml-2 font-bold">{recommendation.forex_setup.indicators.rsi.value?.toFixed(1) ?? 'N/A'}</span>
                    <p className="text-xs text-muted-foreground">{recommendation.forex_setup.indicators.rsi.interpretation || ''}</p>
                  </div>
                )}
                {recommendation.forex_setup.indicators.macd && (
                  <div>
                    <span className="text-muted-foreground">MACD:</span>
                    <span className="ml-2 font-bold">{recommendation.forex_setup.indicators.macd.histogram?.toFixed(5) ?? 'N/A'}</span>
                    <p className="text-xs text-muted-foreground">{recommendation.forex_setup.indicators.macd.interpretation || ''}</p>
                  </div>
                )}
                {recommendation.forex_setup.indicators.stochastic && (
                  <div>
                    <span className="text-muted-foreground">Stoch:</span>
                    <span className="ml-2 font-bold">{recommendation.forex_setup.indicators.stochastic.k?.toFixed(1) ?? '0'}/{recommendation.forex_setup.indicators.stochastic.d?.toFixed(1) ?? '0'}</span>
                    <p className="text-xs text-muted-foreground">{recommendation.forex_setup.indicators.stochastic.interpretation || ''}</p>
                  </div>
                )}
                {recommendation.forex_setup.indicators.ema && (
                  <div>
                    <span className="text-muted-foreground">EMAs:</span>
                    <p className="text-xs text-muted-foreground">{recommendation.forex_setup.indicators.ema.interpretation || ''}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timing & Session */}
          {recommendation.forex_setup.timing && (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <p className="text-sm font-medium text-amber-500 mb-2">Timing & News</p>
              <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                <div>
                  <span className="text-muted-foreground">Session:</span>
                  <span className="ml-2 font-bold">{recommendation.forex_setup.timing.currentSession}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valid Until:</span>
                  <span className="ml-2 font-bold">{recommendation.forex_setup.timing.expiryTime}</span>
                </div>
              </div>
              {recommendation.forex_setup.timing.newsWarnings && recommendation.forex_setup.timing.newsWarnings.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-500 font-medium">News Warnings:</p>
                  {recommendation.forex_setup.timing.newsWarnings.map((warning, i) => (
                    <p key={i} className="text-xs text-amber-400">⚠️ {warning}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Execution Instructions */}
          {recommendation.forex_setup.execution && recommendation.forex_setup.trade && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Execution Instructions</p>
              <div className="text-sm space-y-2">
                <p><span className="text-muted-foreground">Entry:</span> Place {recommendation.forex_setup.trade.action} order at {formatPrice(recommendation.forex_setup.trade.entryPrice, recommendation.forex_setup.pair, true)}</p>
                <p><span className="text-muted-foreground">Profit Targets:</span></p>
                <ul className="list-disc list-inside ml-4 text-emerald-400">
                  <li>TP1: {formatPrice(recommendation.forex_setup.trade.takeProfit1, recommendation.forex_setup.pair, true)} ({recommendation.forex_setup.trade.takeProfit1Pips?.toFixed(1) ?? '0'} pips)</li>
                  <li>TP2: {formatPrice(recommendation.forex_setup.trade.takeProfit2, recommendation.forex_setup.pair, true)} ({recommendation.forex_setup.trade.takeProfit2Pips?.toFixed(1) ?? '0'} pips)</li>
                  <li>TP3: {formatPrice(recommendation.forex_setup.trade.takeProfit3, recommendation.forex_setup.pair, true)} ({recommendation.forex_setup.trade.takeProfit3Pips?.toFixed(1) ?? '0'} pips)</li>
                </ul>
                <p><span className="text-muted-foreground">Stop Loss:</span> <span className="text-red-400">{formatPrice(recommendation.forex_setup.trade.stopLoss, recommendation.forex_setup.pair, true)} ({recommendation.forex_setup.trade.stopLossPips?.toFixed(1) ?? '0'} pips)</span></p>
              </div>
              {recommendation.forex_setup.execution.managementRules && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground font-medium">Management Rules:</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                    {recommendation.forex_setup.execution.managementRules.map((rule, i) => (
                      <li key={i}>{rule}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Data Sources */}
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4">Data Sources</h3>
        <div className="flex flex-wrap gap-2">
          {Array.isArray(recommendation.data_sources) && recommendation.data_sources.map((source, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="rounded-lg bg-muted/50 text-muted-foreground"
            >
              {source}
            </Badge>
          ))}
          {(!recommendation.data_sources || recommendation.data_sources.length === 0) && (
            <span className="text-sm text-muted-foreground">No data sources recorded</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Generated at {recommendation.generated_at ? new Date(recommendation.generated_at).toLocaleString() : 'Unknown'}
        </p>
      </div>
    </div>
  );
}

function FactorItem({ factor, type }: { factor: KeyFactor; type: 'bullish' | 'bearish' }) {
  const color = type === 'bullish' ? 'bg-emerald-500' : 'bg-red-500';

  return (
    <li className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{factor.factor}</p>
        <p className="text-xs text-muted-foreground">{factor.source}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="h-2 w-16 bg-muted/50 rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${factor.weight}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{factor.weight}%</span>
      </div>
    </li>
  );
}
