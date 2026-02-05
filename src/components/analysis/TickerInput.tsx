'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AnalysisType } from '@/types/analysis';

interface TickerInputProps {
  analysisType: AnalysisType;
  onSubmit: (symbol: string, context?: string) => void;
  isLoading: boolean;
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LoaderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

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
    </svg>
  );
}

function AlertIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// Common forex currency codes
const FOREX_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF',
  'HKD', 'SGD', 'SEK', 'DKK', 'NOK', 'MXN', 'ZAR', 'TRY',
  'CNY', 'CNH', 'INR', 'BRL', 'RUB', 'PLN', 'THB', 'IDR'
];

// Detect if symbol looks like a forex pair
function detectSymbolType(symbol: string): 'forex' | 'stock' | 'unknown' {
  const cleaned = symbol.toUpperCase().trim();

  if (!cleaned) return 'unknown';

  // Check for slash format (EUR/USD)
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    if (parts.length === 2) {
      const [base, quote] = parts;
      if (FOREX_CURRENCIES.includes(base) && FOREX_CURRENCIES.includes(quote)) {
        return 'forex';
      }
    }
    // Has slash but not recognized as forex - could be invalid
    return 'unknown';
  }

  // Check for concatenated format (EURUSD, GBPJPY)
  if (cleaned.length === 6) {
    const base = cleaned.substring(0, 3);
    const quote = cleaned.substring(3, 6);
    if (FOREX_CURRENCIES.includes(base) && FOREX_CURRENCIES.includes(quote)) {
      return 'forex';
    }
  }

  // Check for common forex patterns with numbers (EUR/USD often typed as EURUSD)
  for (const currency of FOREX_CURRENCIES) {
    if (cleaned.startsWith(currency) && cleaned.length >= 6) {
      const possibleQuote = cleaned.substring(3, 6);
      if (FOREX_CURRENCIES.includes(possibleQuote)) {
        return 'forex';
      }
    }
  }

  // Stock tickers are typically 1-5 characters, all letters
  if (/^[A-Z]{1,5}$/.test(cleaned)) {
    return 'stock';
  }

  // Could be either
  return 'unknown';
}

// Get validation warning message
function getValidationWarning(
  symbol: string,
  analysisType: AnalysisType,
  detectedType: 'forex' | 'stock' | 'unknown'
): { message: string; suggestion: string } | null {
  // Only validate for stock and forex analysis types
  if (analysisType !== 'stock' && analysisType !== 'forex') {
    return null;
  }

  // If we can't detect the type, no warning
  if (detectedType === 'unknown') {
    return null;
  }

  // Check for mismatch
  if (analysisType === 'stock' && detectedType === 'forex') {
    return {
      message: `"${symbol}" looks like a forex pair, but you selected Stock Analysis.`,
      suggestion: 'Switch to Forex Analysis for currency pairs, or enter a stock ticker like AAPL, TSLA, etc.',
    };
  }

  if (analysisType === 'forex' && detectedType === 'stock') {
    return {
      message: `"${symbol}" looks like a stock ticker, but you selected Forex Analysis.`,
      suggestion: 'Switch to Stock Analysis for stocks, or enter a forex pair like EUR/USD, GBP/JPY, etc.',
    };
  }

  return null;
}

export function TickerInput({ analysisType, onSubmit, isLoading }: TickerInputProps) {
  const [symbol, setSymbol] = useState('');
  const [context, setContext] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Detect symbol type and check for mismatches
  const detectedType = useMemo(() => detectSymbolType(symbol), [symbol]);
  const validationWarning = useMemo(
    () => getValidationWarning(symbol, analysisType, detectedType),
    [symbol, analysisType, detectedType]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Don't submit if there's a validation warning
    if (validationWarning) {
      return;
    }

    if (symbol.trim()) {
      onSubmit(symbol.trim().toUpperCase(), context.trim() || undefined);
    }
  };

  const placeholder = analysisType === 'forex' ? 'EUR/USD' : 'AAPL';
  const label = analysisType === 'forex' ? 'Currency Pair' : 'Ticker Symbol';

  const popularTickers = analysisType === 'forex'
    ? ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD']
    : ['AAPL', 'NVDA', 'TSLA', 'SPY', 'AMZN', 'META'];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Ticker Input */}
      <div className="space-y-3">
        <Label htmlFor="symbol" className="text-sm font-medium">
          {label}
        </Label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <SearchIcon className="h-5 w-5" />
          </div>
          <Input
            id="symbol"
            placeholder={placeholder}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isLoading}
            className={`pl-12 pr-4 py-6 text-xl font-mono rounded-xl glass-subtle border-border/50
              focus:border-primary focus:glow-primary transition-all
              ${isFocused ? 'glow-primary' : ''}
              ${validationWarning ? 'border-amber-500 focus:border-amber-500' : ''}`}
            maxLength={10}
          />
        </div>

        {/* Validation Warning */}
        {validationWarning && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-500">
                {validationWarning.message}
              </p>
              <p className="text-sm text-muted-foreground">
                {validationWarning.suggestion}
              </p>
            </div>
          </div>
        )}

        {/* Popular Tickers */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Popular:</span>
          {popularTickers.map((ticker) => (
            <button
              key={ticker}
              type="button"
              onClick={() => setSymbol(ticker)}
              className="px-3 py-1 text-xs font-medium rounded-full glass-subtle
                hover:bg-primary/10 hover:text-primary transition-all"
            >
              {ticker}
            </button>
          ))}
        </div>
      </div>

      {/* Context Input */}
      <div className="space-y-3">
        <Label htmlFor="context" className="text-sm font-medium">
          Additional Context{' '}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="context"
          placeholder="Any specific questions or focus areas? (e.g., 'Looking for swing trade opportunity' or 'Concerned about upcoming earnings')"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          disabled={isLoading}
          rows={3}
          className="rounded-xl glass-subtle border-border/50 focus:border-primary
            focus:glow-primary transition-all resize-none"
        />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!symbol.trim() || isLoading || !!validationWarning}
        className="w-full py-6 text-lg font-semibold rounded-xl
          bg-gradient-to-r from-primary to-primary/90
          hover:from-primary/90 hover:to-primary
          glow-primary hover:scale-[1.02] transition-all duration-300
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isLoading ? (
          <span className="flex items-center gap-3">
            <LoaderIcon className="h-5 w-5" />
            Analyzing...
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <SparklesIcon className="h-5 w-5" />
            Start AI Analysis
          </span>
        )}
      </Button>
    </form>
  );
}
