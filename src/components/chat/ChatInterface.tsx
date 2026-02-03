'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  kbUsed?: boolean;
  sources?: string[];
  toolsUsed?: string[];
}

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
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

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          include_kb: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        kbUsed: data.kb_used,
        sources: data.sources || [],
        toolsUsed: data.tools_used || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <SparklesIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">AI Trading Assistant</h2>
            <p className="text-xs text-muted-foreground">
              Real-time market data & knowledge base
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
          Online
        </Badge>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="p-4 rounded-2xl bg-primary/10 mb-4">
                <SparklesIcon className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Welcome to CheekyTrader AI
              </h3>
              <p className="text-muted-foreground max-w-md mb-8">
                Ask me anything about trading! I can fetch real-time stock prices, forex rates,
                news, earnings data, and search the web for current market information.
              </p>
              <div className="space-y-3 w-full max-w-md">
                <p className="text-sm text-muted-foreground">Try asking:</p>
                <div className="grid gap-2">
                  {[
                    'What is the current price of AAPL?',
                    'What is the EUR/USD exchange rate?',
                    'What are the latest news for TSLA?',
                    'Explain options Greeks to me',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="p-3 rounded-xl glass-subtle text-left text-sm
                        hover:bg-primary/5 hover:text-primary transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 rounded-xl flex-shrink-0">
                      <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-xs">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'glass-subtle'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-p:my-2 prose-p:leading-relaxed
                        prose-headings:my-3 prose-headings:font-semibold
                        prose-ul:my-2 prose-ol:my-2
                        prose-li:my-0.5
                        prose-strong:text-primary prose-strong:font-semibold
                        prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs
                        prose-pre:bg-muted prose-pre:rounded-xl prose-pre:p-4
                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                      <span>
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {message.sources && message.sources.includes('knowledge_base') && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"
                        >
                          KB
                        </Badge>
                      )}
                      {message.sources && message.sources.includes('web_search') && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-500"
                        >
                          Web
                        </Badge>
                      )}
                      {message.sources && message.sources.includes('analysis_history') && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-500"
                        >
                          History
                        </Badge>
                      )}
                      {message.sources && message.sources.includes('market_data') && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-500"
                        >
                          Live Data
                        </Badge>
                      )}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 rounded-xl flex-shrink-0">
                      <AvatarFallback className="rounded-xl bg-muted font-semibold text-xs">
                        You
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 rounded-xl flex-shrink-0">
                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-xs">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div className="glass-subtle rounded-2xl p-4">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <span
                        className="w-2 h-2 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <span
                        className="w-2 h-2 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            placeholder="Ask about trading, strategies, or market analysis..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 py-6 rounded-xl glass-subtle border-border/50
              focus:border-primary focus:glow-primary"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 rounded-xl bg-primary hover:bg-primary/90
              glow-primary hover:scale-105 transition-all"
          >
            <SendIcon className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
