'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToolCall } from '@/types/analysis';

interface AgentProgressProps {
  toolCalls: ToolCall[];
}

const toolConfig: Record<string, { icon: string; color: string }> = {
  get_stock_price: { icon: '💰', color: 'text-emerald-500' },
  get_historical_data: { icon: '📉', color: 'text-blue-500' },
  get_options_chain: { icon: '📋', color: 'text-purple-500' },
  get_news_sentiment: { icon: '📰', color: 'text-orange-500' },
  get_earnings_calendar: { icon: '📅', color: 'text-pink-500' },
  get_analyst_ratings: { icon: '⭐', color: 'text-yellow-500' },
  get_unusual_options_flow: { icon: '🔥', color: 'text-red-500' },
  search_trading_knowledge: { icon: '📚', color: 'text-cyan-500' },
};

export function AgentProgress({ toolCalls }: AgentProgressProps) {
  if (toolCalls.length === 0) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[200px] text-center">
        <div className="text-4xl mb-3 animate-pulse">🤖</div>
        <p className="text-muted-foreground text-sm">
          AI agent is starting...
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Agent Activity</h3>
          <p className="text-sm text-muted-foreground">
            Real-time tool execution
          </p>
        </div>
        <Badge
          variant="secondary"
          className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary border-0"
        >
          {toolCalls.length} calls
        </Badge>
      </div>

      {/* Tool Calls List */}
      <ScrollArea className="h-[280px] pr-2">
        <div className="space-y-3">
          {toolCalls.map((call, index) => {
            const config = toolConfig[call.name] || {
              icon: '🔧',
              color: 'text-muted-foreground',
            };
            const hasError =
              call.result &&
              typeof call.result === 'object' &&
              'error' in call.result;
            const isLatest = index === toolCalls.length - 1;

            return (
              <div
                key={index}
                className={`relative p-4 rounded-xl transition-all duration-300 ${
                  isLatest
                    ? 'glass-card glow-primary'
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                {/* Connecting Line */}
                {index < toolCalls.length - 1 && (
                  <div className="absolute left-7 top-14 w-0.5 h-6 bg-border" />
                )}

                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                      ${isLatest ? 'bg-primary/10' : 'bg-muted/50'}`}
                  >
                    <span className="text-xl">{config.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-medium text-sm capitalize ${
                          isLatest ? 'text-primary' : ''
                        }`}
                      >
                        {call.name.replace(/_/g, ' ')}
                      </span>
                      {hasError ? (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Error
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-500"
                        >
                          Success
                        </Badge>
                      )}
                    </div>

                    {/* Arguments */}
                    {call.args && Object.keys(call.args).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(call.args).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center px-2 py-0.5 rounded-md
                              bg-muted/50 text-[10px] text-muted-foreground font-mono"
                          >
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Duration */}
                    {call.duration_ms && (
                      <p className="text-[10px] text-muted-foreground">
                        Completed in {call.duration_ms}ms
                      </p>
                    )}
                  </div>

                  {/* Status Indicator */}
                  {isLatest && (
                    <div className="flex-shrink-0">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
