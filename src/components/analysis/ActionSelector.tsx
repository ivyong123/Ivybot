'use client';

import { cn } from '@/lib/utils';
import { AnalysisType, isStandaloneAnalysis } from '@/types/analysis';

// Icon Components
function TrendingUpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function CurrencyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8" />
      <line x1="3" x2="6" y1="3" y2="6" />
      <line x1="21" x2="18" y1="3" y2="6" />
      <line x1="3" x2="6" y1="21" y2="18" />
      <line x1="21" x2="18" y1="21" y2="18" />
    </svg>
  );
}

function ChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
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

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function NewspaperIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

function WavesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  );
}

interface AnalysisOption {
  type: AnalysisType;
  title: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  gradient: string;
  iconColor: string;
  isStandalone: boolean;
}

const analysisOptions: AnalysisOption[] = [
  // Full Analysis Options
  {
    type: 'stock',
    title: 'Stock Analysis',
    description: 'Full AI-powered analysis with trade recommendations',
    icon: TrendingUpIcon,
    gradient: 'from-emerald-500/20 to-green-500/20',
    iconColor: 'text-emerald-500',
    isStandalone: false,
  },
  {
    type: 'forex',
    title: 'Forex Analysis',
    description: 'Full currency pair analysis with entry/exit levels',
    icon: CurrencyIcon,
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-500',
    isStandalone: false,
  },
  // Standalone Data Options
  {
    type: 'technical',
    title: 'Technical Analysis',
    description: 'OHLCV data with RSI, MACD, support/resistance',
    icon: ChartIcon,
    gradient: 'from-purple-500/20 to-violet-500/20',
    iconColor: 'text-purple-500',
    isStandalone: true,
  },
  {
    type: 'fundamentals',
    title: 'Fundamentals',
    description: 'Analyst ratings, price targets, consensus',
    icon: TargetIcon,
    gradient: 'from-orange-500/20 to-amber-500/20',
    iconColor: 'text-orange-500',
    isStandalone: true,
  },
  {
    type: 'earnings',
    title: 'Earnings',
    description: 'Earnings calendar, EPS estimates, history',
    icon: CalendarIcon,
    gradient: 'from-pink-500/20 to-rose-500/20',
    iconColor: 'text-pink-500',
    isStandalone: true,
  },
  {
    type: 'news',
    title: 'News & Sentiment',
    description: 'Recent news with sentiment analysis',
    icon: NewspaperIcon,
    gradient: 'from-teal-500/20 to-emerald-500/20',
    iconColor: 'text-teal-500',
    isStandalone: true,
  },
  {
    type: 'smart_money',
    title: 'Smart Money',
    description: 'Options flow, insider trades, institutional data',
    icon: WavesIcon,
    gradient: 'from-indigo-500/20 to-blue-500/20',
    iconColor: 'text-indigo-500',
    isStandalone: true,
  },
];

interface ActionSelectorProps {
  selected: AnalysisType;
  onSelect: (type: AnalysisType) => void;
}

export function ActionSelector({ selected, onSelect }: ActionSelectorProps) {
  const fullAnalysisOptions = analysisOptions.filter(o => !o.isStandalone);
  const standaloneOptions = analysisOptions.filter(o => o.isStandalone);

  return (
    <div className="space-y-6">
      {/* Full Analysis Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-sm font-medium text-muted-foreground">Full Trading Analysis</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {fullAnalysisOptions.map((option) => (
            <OptionCard
              key={option.type}
              option={option}
              selected={selected === option.type}
              onSelect={() => onSelect(option.type)}
            />
          ))}
        </div>
      </div>

      {/* Standalone Data Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Quick Data Lookup (No Trading Prediction)</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {standaloneOptions.map((option) => (
            <OptionCardSmall
              key={option.type}
              option={option}
              selected={selected === option.type}
              onSelect={() => onSelect(option.type)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: AnalysisOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'relative p-6 rounded-2xl text-left transition-all duration-300 group overflow-hidden',
        'border border-border/50 hover:border-primary/50',
        selected
          ? 'glass-card border-primary glow-primary'
          : 'glass-subtle hover:glass-card'
      )}
      onClick={onSelect}
    >
      {/* Background Gradient */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300',
          option.gradient,
          selected ? 'opacity-100' : 'group-hover:opacity-50'
        )}
      />

      {/* Content */}
      <div className="relative space-y-3">
        <div className="flex items-center justify-between">
          <div className={cn('p-3 rounded-xl bg-background/50', option.iconColor)}>
            <option.icon className="h-7 w-7" />
          </div>
          {selected && (
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>
        <div>
          <h3
            className={cn(
              'font-semibold text-lg transition-colors',
              selected ? 'text-primary' : 'group-hover:text-primary'
            )}
          >
            {option.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {option.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function OptionCardSmall({
  option,
  selected,
  onSelect,
}: {
  option: AnalysisOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'relative p-4 rounded-xl text-left transition-all duration-300 group overflow-hidden',
        'border border-border/50 hover:border-primary/50',
        selected
          ? 'glass-card border-primary glow-primary'
          : 'glass-subtle hover:glass-card'
      )}
      onClick={onSelect}
    >
      {/* Background Gradient */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300',
          option.gradient,
          selected ? 'opacity-100' : 'group-hover:opacity-50'
        )}
      />

      {/* Content */}
      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <div className={cn('p-2 rounded-lg bg-background/50', option.iconColor)}>
            <option.icon className="h-5 w-5" />
          </div>
          {selected && (
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>
        <div>
          <h3
            className={cn(
              'font-medium text-sm transition-colors',
              selected ? 'text-primary' : 'group-hover:text-primary'
            )}
          >
            {option.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
            {option.description}
          </p>
        </div>
      </div>
    </button>
  );
}
