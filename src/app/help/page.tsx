import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'User Guide | CheekyTrader AI',
  description: 'Learn how to use CheekyTrader AI for stock and forex analysis',
};

function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-border/50">
        <div className="container py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8 max-w-4xl">
        <article className="prose prose-invert max-w-none">
          <h1 className="gradient-text">CheekyTrader AI - User Guide</h1>
          <p className="lead text-muted-foreground">
            A comprehensive guide to using CheekyTrader AI for stock options and forex trading analysis.
          </p>

          <hr className="border-border/50" />

          {/* Table of Contents */}
          <nav className="glass-subtle rounded-xl p-6 my-8">
            <h2 className="text-lg font-semibold mb-4 mt-0">Table of Contents</h2>
            <ol className="grid grid-cols-1 md:grid-cols-2 gap-2 list-decimal list-inside text-sm">
              <li><a href="#getting-started" className="text-primary hover:underline">Getting Started</a></li>
              <li><a href="#analysis-types" className="text-primary hover:underline">Analysis Types</a></li>
              <li><a href="#entering-symbols" className="text-primary hover:underline">Entering Symbols</a></li>
              <li><a href="#additional-context" className="text-primary hover:underline">Using Additional Context</a></li>
              <li><a href="#stock-output" className="text-primary hover:underline">Stock Analysis Output</a></li>
              <li><a href="#forex-output" className="text-primary hover:underline">Forex Analysis Output</a></li>
              <li><a href="#order-types" className="text-primary hover:underline">Order Types</a></li>
              <li><a href="#risk-management" className="text-primary hover:underline">Risk Management</a></li>
              <li><a href="#best-practices" className="text-primary hover:underline">Best Practices</a></li>
              <li><a href="#quick-reference" className="text-primary hover:underline">Quick Reference</a></li>
            </ol>
          </nav>

          {/* Getting Started */}
          <section id="getting-started">
            <h2>Getting Started</h2>
            <h3>What is CheekyTrader AI?</h3>
            <p>CheekyTrader AI is an AI-powered trading analysis tool that provides:</p>
            <ul>
              <li><strong>Stock Analysis</strong>: Options trading recommendations with whale/smart money data</li>
              <li><strong>Forex Analysis</strong>: Currency pair and commodity analysis with pip-based setups</li>
            </ul>

            <h3>Dashboard Overview</h3>
            <p>When you log in, you&apos;ll see:</p>
            <ol>
              <li><strong>Analysis Type Selector</strong>: Choose between Stock or Forex analysis</li>
              <li><strong>Symbol Input</strong>: Enter the ticker or currency pair</li>
              <li><strong>Additional Context</strong>: Optional field to customize your analysis</li>
              <li><strong>Start Analysis Button</strong>: Begin the AI analysis</li>
            </ol>
          </section>

          {/* Analysis Types */}
          <section id="analysis-types">
            <h2>Analysis Types</h2>

            <div className="glass-subtle rounded-xl p-6 my-4">
              <h3 className="mt-0">Stock Analysis (Options Trading)</h3>
              <p><strong>Best for:</strong> US stocks (AAPL, TSLA, NVDA, SPY), Options strategies, Swing trades (1-8 weeks)</p>
              <p><strong>What you get:</strong></p>
              <ul className="mb-0">
                <li>Unusual Whales smart money flow analysis (60-70% weight)</li>
                <li>Technical analysis with support/resistance</li>
                <li>Options strategy recommendations with Greeks</li>
                <li>Earnings calendar and news sentiment</li>
              </ul>
            </div>

            <div className="glass-subtle rounded-xl p-6 my-4">
              <h3 className="mt-0">Forex Analysis</h3>
              <p><strong>Best for:</strong> Currency pairs (EUR/USD, GBP/JPY), Commodities (XAU/USD gold, XAG/USD silver), Day/Swing trading</p>
              <p><strong>What you get:</strong></p>
              <ul className="mb-0">
                <li>Technical analysis across multiple timeframes</li>
                <li>Economic calendar events</li>
                <li>Entry price with order type (BUY LIMIT, SELL STOP, etc.)</li>
                <li>Stop loss and 3 take profit levels in pips</li>
              </ul>
            </div>
          </section>

          {/* Entering Symbols */}
          <section id="entering-symbols">
            <h2>Entering Symbols</h2>

            <h3>Stock Symbols</h3>
            <p>Enter standard US ticker symbols:</p>
            <div className="flex flex-wrap gap-2 my-4">
              {['AAPL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'AMZN'].map(s => (
                <code key={s} className="px-2 py-1 rounded bg-primary/10 text-primary">{s}</code>
              ))}
            </div>

            <h3>Forex Pairs</h3>
            <p>Enter currency pairs in either format:</p>
            <div className="flex flex-wrap gap-2 my-4">
              {['EUR/USD', 'GBP/JPY', 'EURUSD', 'USDJPY'].map(s => (
                <code key={s} className="px-2 py-1 rounded bg-primary/10 text-primary">{s}</code>
              ))}
            </div>

            <h3>Commodities (Forex Mode)</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Instrument</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><code>XAU/USD</code></td><td>Gold</td></tr>
                  <tr><td><code>XAG/USD</code></td><td>Silver</td></tr>
                  <tr><td><code>XTI/USD</code></td><td>WTI Crude Oil</td></tr>
                  <tr><td><code>XBR/USD</code></td><td>Brent Crude Oil</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Additional Context */}
          <section id="additional-context">
            <h2>Using Additional Context</h2>
            <div className="glass border-l-4 border-primary rounded-xl p-6 my-4">
              <p className="font-semibold text-primary mb-2">Important!</p>
              <p className="mb-0">The Additional Context field carries <strong>30-40% weight</strong> in the analysis output. Use it wisely!</p>
            </div>

            <h3>Effective Context Examples</h3>

            <div className="grid gap-4 my-4">
              <div className="glass-subtle rounded-lg p-4">
                <p className="font-medium text-primary mb-1">For Scalp Trading</p>
                <code className="text-sm">&quot;Looking for a quick scalp trade, 15-30 minute hold max. Prefer tight stop loss.&quot;</code>
              </div>
              <div className="glass-subtle rounded-lg p-4">
                <p className="font-medium text-primary mb-1">For Swing Trading</p>
                <code className="text-sm">&quot;Swing trade opportunity for 3-5 day hold. Looking for key support/resistance levels.&quot;</code>
              </div>
              <div className="glass-subtle rounded-lg p-4">
                <p className="font-medium text-primary mb-1">For Position Management</p>
                <code className="text-sm">&quot;Already long from $150, looking for exit signals and where to take profits.&quot;</code>
              </div>
              <div className="glass-subtle rounded-lg p-4">
                <p className="font-medium text-primary mb-1">For Risk-Averse Trading</p>
                <code className="text-sm">&quot;Conservative approach only. Need high confidence setups with minimum 3:1 risk-reward.&quot;</code>
              </div>
              <div className="glass-subtle rounded-lg p-4">
                <p className="font-medium text-primary mb-1">For Session-Specific (Forex)</p>
                <code className="text-sm">&quot;I only trade London session. Best entry during 08:00-12:00 GMT.&quot;</code>
              </div>
            </div>

            <h3>What NOT to Write</h3>
            <ul>
              <li><strong>Vague statements:</strong> &quot;What do you think?&quot; (too generic)</li>
              <li><strong>Price predictions:</strong> &quot;Will it go to $200?&quot;</li>
              <li><strong>Multiple unrelated questions</strong> (keep it focused)</li>
            </ul>
          </section>

          {/* Stock Output */}
          <section id="stock-output">
            <h2>Understanding Stock Analysis Output</h2>

            <h3>Recommendation Types</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Recommendation</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="text-green-500 font-medium">Strong Buy</td><td>High confidence bullish (85-95%)</td></tr>
                  <tr><td className="text-green-400 font-medium">Buy</td><td>Moderate confidence bullish (70-84%)</td></tr>
                  <tr><td className="text-yellow-500 font-medium">Hold</td><td>Neutral, no clear edge</td></tr>
                  <tr><td className="text-red-400 font-medium">Sell</td><td>Moderate confidence bearish (70-84%)</td></tr>
                  <tr><td className="text-red-500 font-medium">Strong Sell</td><td>High confidence bearish (85-95%)</td></tr>
                  <tr><td className="text-muted-foreground font-medium">Wait</td><td>No trade - conditions not favorable</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Smart Money Analysis</h3>
            <p>The analysis shows whale activity from Unusual Whales:</p>
            <ul>
              <li><strong>Whale Trades</strong>: Large trades ($100K+ premium)</li>
              <li><strong>Sweeps</strong>: Urgent orders hitting multiple exchanges</li>
              <li><strong>Call/Put Premium</strong>: Which direction smart money is betting</li>
              <li><strong>Hot Strikes</strong>: Where whale activity is concentrated</li>
            </ul>
          </section>

          {/* Forex Output */}
          <section id="forex-output">
            <h2>Understanding Forex Analysis Output</h2>

            <h3>Stop Loss & Take Profits</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><strong>Stop Loss (SL)</strong></td><td>Exit if trade goes against you</td></tr>
                  <tr><td><strong>Take Profit 1 (TP1)</strong></td><td>Conservative target (1:1 R:R)</td></tr>
                  <tr><td><strong>Take Profit 2 (TP2)</strong></td><td>Standard target (2:1 R:R)</td></tr>
                  <tr><td><strong>Take Profit 3 (TP3)</strong></td><td>Extended target (3:1 R:R)</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Pip Values by Instrument</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>1 Pip =</th>
                    <th>0.1 Lot Value</th>
                    <th>Example Move</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>EUR/USD, GBP/USD</td><td>0.0001</td><td>$1/pip</td><td>1.0850 → 1.0860 = 10 pips = $10</td></tr>
                  <tr><td>USD/JPY, EUR/JPY</td><td>0.01</td><td>~$0.67/pip</td><td>149.50 → 149.60 = 10 pips = $6.70</td></tr>
                  <tr><td>XAU/USD (Gold)</td><td>$0.10</td><td>$1/pip</td><td>2050.00 → 2051.00 = 10 pips = $10</td></tr>
                  <tr><td>XAG/USD (Silver)</td><td>$0.01</td><td>$5/pip</td><td>23.50 → 24.00 = 50 pips = $250</td></tr>
                  <tr><td>XTI/USD (Oil)</td><td>$0.01</td><td>$0.10/pip</td><td>78.50 → 79.00 = 50 pips = $5</td></tr>
                </tbody>
              </table>
            </div>

            <div className="glass border-l-4 border-primary rounded-xl p-6 my-4">
              <p className="font-semibold text-primary mb-2">Key Insight</p>
              <p className="mb-0">Gold (XAU/USD) has the <strong>same pip value as EUR/USD</strong> with 0.1 lot ($1/pip). So 10 pips on gold = $10 with 0.1 lot, just like forex!</p>
            </div>

            <h3>Session Recommendations</h3>
            <ul>
              <li><strong>London Session</strong>: 08:00-17:00 GMT (best for EUR, GBP, CHF)</li>
              <li><strong>New York Session</strong>: 13:00-22:00 GMT (best for USD pairs)</li>
              <li><strong>Asian Session</strong>: 00:00-09:00 GMT (best for JPY, AUD, NZD)</li>
              <li><strong>London-NY Overlap</strong>: 13:00-17:00 GMT (highest volatility)</li>
            </ul>
          </section>

          {/* Order Types */}
          <section id="order-types">
            <h2>Order Types Explained</h2>

            <h3>Forex Order Types</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Order Type</th>
                    <th>When to Use</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><strong>BUY LIMIT</strong></td><td>Buy below current price (expect bounce from support)</td></tr>
                  <tr><td><strong>BUY STOP</strong></td><td>Buy above current price (breakout trade)</td></tr>
                  <tr><td><strong>SELL LIMIT</strong></td><td>Sell above current price (expect rejection from resistance)</td></tr>
                  <tr><td><strong>SELL STOP</strong></td><td>Sell below current price (breakdown trade)</td></tr>
                  <tr><td><strong>MARKET</strong></td><td>Enter immediately at current price</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Risk Management */}
          <section id="risk-management">
            <h2>Risk Management</h2>

            <h3>Position Sizing</h3>
            <p>The analysis suggests <strong>0.5-1% risk per trade</strong>. This means:</p>
            <ul>
              <li>If your account is $10,000</li>
              <li>Risk per trade = $50-100</li>
              <li>Calculate lot size based on SL distance</li>
            </ul>

            <h3>Managing Take Profits</h3>
            <p>Recommended approach:</p>
            <ol>
              <li><strong>At TP1</strong>: Close 50% of position, move SL to breakeven</li>
              <li><strong>At TP2</strong>: Close 30% of remaining position</li>
              <li><strong>At TP3</strong>: Close final 20%</li>
            </ol>

            <div className="glass border-l-4 border-yellow-500 rounded-xl p-6 my-4">
              <p className="font-semibold text-yellow-500 mb-2">When NOT to Trade</p>
              <p className="mb-0">The AI will recommend &quot;Wait&quot; when confidence is below 55-60%, high-impact news is imminent, or risk-to-reward is below 2:1. <strong>Trust the Wait recommendation!</strong></p>
            </div>
          </section>

          {/* Best Practices */}
          <section id="best-practices">
            <h2>Best Practices</h2>

            <div className="grid md:grid-cols-2 gap-4 my-4">
              <div className="glass-subtle rounded-xl p-6">
                <h3 className="mt-0 text-green-500">Do This</h3>
                <ul className="mb-0">
                  <li>Use Additional Context for your specific needs</li>
                  <li>Review all sections, not just buy/sell</li>
                  <li>Set SL/TP immediately after entry</li>
                  <li>Take partial profits at TP1</li>
                  <li>Journal your trades</li>
                </ul>
              </div>
              <div className="glass-subtle rounded-xl p-6">
                <h3 className="mt-0 text-red-500">Avoid This</h3>
                <ul className="mb-0">
                  <li>Chasing trades after missing entry</li>
                  <li>Moving SL further away</li>
                  <li>Trading when AI says &quot;Wait&quot;</li>
                  <li>Revenge trading after a loss</li>
                  <li>Risking more than planned</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Quick Reference */}
          <section id="quick-reference">
            <h2>Quick Reference</h2>

            <h3>Confidence Levels</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Meaning</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>85-95%</td><td>Strong confluence</td><td>Trade with full size</td></tr>
                  <tr><td>70-84%</td><td>Good setup</td><td>Trade with normal size</td></tr>
                  <tr><td>55-69%</td><td>Mixed signals</td><td>Trade with reduced size</td></tr>
                  <tr><td>&lt;55%</td><td>No edge</td><td>Don&apos;t trade (Wait)</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Pip Ranges by Instrument (with 0.1 lot $ values)</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>1 Pip Value</th>
                    <th>SL Range</th>
                    <th>TP1</th>
                    <th>TP2</th>
                    <th>TP3</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>EUR/USD, GBP/USD</td><td>$1/pip</td><td>20-50 pips ($20-50)</td><td>25+</td><td>50+</td><td>75+</td></tr>
                  <tr><td>USD/JPY</td><td>~$0.67/pip</td><td>25-50 pips ($17-34)</td><td>25+</td><td>50+</td><td>75+</td></tr>
                  <tr><td>XAU/USD (Gold)</td><td>$1/pip</td><td>30-70 pips ($30-70)</td><td>50+</td><td>100+</td><td>150+</td></tr>
                  <tr><td>XAG/USD (Silver)</td><td>$5/pip</td><td>30-80 pips ($150-400)</td><td>50+</td><td>100+</td><td>150+</td></tr>
                  <tr><td>XTI/USD (Oil)</td><td>$0.10/pip</td><td>30-80 pips ($3-8)</td><td>50+</td><td>100+</td><td>150+</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <hr className="border-border/50" />

          <p className="text-sm text-muted-foreground italic">
            This guide is for educational purposes. Always do your own research and never risk more than you can afford to lose.
          </p>
        </article>
      </div>
    </div>
  );
}
