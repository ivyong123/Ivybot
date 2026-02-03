'use client';

import { useState } from 'react';
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

export function TickerInput({ analysisType, onSubmit, isLoading }: TickerInputProps) {
  const [symbol, setSymbol] = useState('');
  const [context, setContext] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
              ${isFocused ? 'glow-primary' : ''}`}
            maxLength={10}
          />
        </div>

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
        disabled={!symbol.trim() || isLoading}
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
