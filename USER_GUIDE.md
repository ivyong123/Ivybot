# CheekyTrader AI - User Guide

A comprehensive guide to using CheekyTrader AI for stock options and forex trading analysis.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Analysis Types](#analysis-types)
3. [Entering Symbols](#entering-symbols)
4. [Using Additional Context](#using-additional-context)
5. [Understanding Stock Analysis Output](#understanding-stock-analysis-output)
6. [Understanding Forex Analysis Output](#understanding-forex-analysis-output)
7. [Order Types Explained](#order-types-explained)
8. [Risk Management](#risk-management)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### What is CheekyTrader AI?

CheekyTrader AI is an AI-powered trading analysis tool that provides:
- **Stock Analysis**: Options trading recommendations with whale/smart money data
- **Forex Analysis**: Currency pair and commodity analysis with pip-based setups

### Dashboard Overview

When you log in, you'll see:
1. **Analysis Type Selector**: Choose between Stock or Forex analysis
2. **Symbol Input**: Enter the ticker or currency pair
3. **Additional Context**: Optional field to customize your analysis
4. **Start Analysis Button**: Begin the AI analysis

---

## Analysis Types

### Stock Analysis (Options Trading)

Best for:
- US stocks (AAPL, TSLA, NVDA, SPY, etc.)
- Options strategies (calls, puts, spreads)
- Swing trades (1-8 weeks)

What you get:
- Unusual Whales smart money flow analysis (60-70% weight)
- Technical analysis with support/resistance
- Options strategy recommendations with Greeks
- Earnings calendar and news sentiment
- Entry, stop loss, and take profit levels

### Forex Analysis

Best for:
- Currency pairs (EUR/USD, GBP/JPY, USD/CAD)
- Commodities (XAU/USD gold, XAG/USD silver, XTI/USD oil)
- Day trading and swing trading

What you get:
- Technical analysis across multiple timeframes
- Economic calendar events
- Entry price with order type (BUY LIMIT, SELL STOP, etc.)
- Stop loss and 3 take profit levels in pips
- Session timing recommendations

---

## Entering Symbols

### Stock Symbols

Enter standard US ticker symbols:
- `AAPL` - Apple Inc.
- `TSLA` - Tesla Inc.
- `NVDA` - Nvidia Corp.
- `SPY` - S&P 500 ETF
- `QQQ` - Nasdaq 100 ETF

### Forex Pairs

Enter currency pairs in either format:
- With slash: `EUR/USD`, `GBP/JPY`, `USD/CAD`
- Without slash: `EURUSD`, `GBPJPY`, `USDCAD`

### Commodities (Forex Mode)

- `XAU/USD` or `XAUUSD` - Gold
- `XAG/USD` or `XAGUSD` - Silver
- `XTI/USD` or `XTIUSD` - WTI Crude Oil
- `XBR/USD` or `XBRUSD` - Brent Crude Oil

### Popular Quick Select

Click on popular tickers shown below the input field for quick selection:
- **Stock**: AAPL, NVDA, TSLA, SPY, AMZN, META
- **Forex**: EUR/USD, GBP/USD, USD/JPY, XAU/USD, XAG/USD

---

## Using Additional Context

The Additional Context field is **powerful** - it carries **30-40% weight** in the analysis output.

### When to Use It

Use additional context when you have:
- A specific trading style or timeframe preference
- Risk tolerance requirements
- Existing positions to manage
- Specific concerns or questions

### Effective Context Examples

#### For Scalp Trading
```
Looking for a quick scalp trade, 15-30 minute hold max.
Prefer tight stop loss and quick profit targets.
```

#### For Swing Trading
```
Swing trade opportunity for 3-5 day hold.
Looking for key support/resistance levels.
```

#### For Day Trading
```
Day trade only - must close by market close.
Focus on intraday momentum.
```

#### For Position Management
```
Already long from $150, looking for exit signals
and where to take profits.
```

#### For Risk-Averse Trading
```
Conservative approach only. Need high confidence
setups with minimum 3:1 risk-reward.
```

#### For News-Based Trading
```
Focused on the upcoming Fed meeting.
How might this impact the trade?
```

#### For Specific Sessions (Forex)
```
I only trade London session.
Best entry during 08:00-12:00 GMT.
```

#### For Earnings Plays (Stocks)
```
Playing earnings next week.
Looking for pre-earnings momentum or post-earnings direction.
```

### What NOT to Write

- Vague statements: "What do you think?" (too generic)
- Price predictions: "Will it go to $200?" (not how the tool works)
- Multiple unrelated questions (keep it focused)

---

## Understanding Stock Analysis Output

### Recommendation Types

| Recommendation | Meaning |
|---------------|---------|
| **Strong Buy** | High confidence bullish setup (85-95%) |
| **Buy** | Moderate confidence bullish (70-84%) |
| **Hold** | Neutral, no clear edge |
| **Sell** | Moderate confidence bearish (70-84%) |
| **Strong Sell** | High confidence bearish (85-95%) |
| **Wait** | No trade - conditions not favorable |

### Smart Money Analysis

The analysis shows whale activity from Unusual Whales:
- **Whale Trades**: Large trades ($100K+ premium)
- **Sweeps**: Urgent orders hitting multiple exchanges
- **Call/Put Premium**: Which direction smart money is betting
- **Hot Strikes**: Where whale activity is concentrated

### Options Strategy Section

When a trade is recommended, you'll see:
- **Strategy Type**: Bull call spread, long calls, iron condor, etc.
- **Contract Names**: Specific options to trade (e.g., AAPL 021424 185 C)
- **Legs**: Each option in the strategy with strike, expiration, action
- **Greeks**: Delta, gamma, theta, vega for risk assessment
- **Max Profit/Loss**: Defined risk parameters
- **Breakeven**: Price where you neither profit nor lose

### Key Factors

Shows what influenced the recommendation:
- Each factor with bullish/bearish/neutral sentiment
- Weight (how much it influenced the decision)
- Source (where the data came from)

---

## Understanding Forex Analysis Output

### Trade Setup Card

The forex analysis provides a complete trade setup:

#### Entry Information
- **Direction**: LONG (buy) or SHORT (sell)
- **Entry Price**: The exact price to enter
- **Order Type**: How to enter the trade

#### Stop Loss & Take Profits

| Level | Purpose |
|-------|---------|
| **Stop Loss (SL)** | Exit if trade goes against you |
| **Take Profit 1 (TP1)** | Conservative target (1:1 R:R) |
| **Take Profit 2 (TP2)** | Standard target (2:1 R:R) |
| **Take Profit 3 (TP3)** | Extended target (3:1 R:R) |

#### Pip Values by Instrument

| Instrument | 1 Pip = | Example |
|------------|---------|---------|
| EUR/USD, GBP/USD | 0.0001 | 1.08520 → 1.08530 = 1 pip |
| USD/JPY, EUR/JPY | 0.01 | 149.50 → 149.51 = 1 pip |
| XAU/USD (Gold) | $0.01 | 2050.00 → 2050.01 = 1 pip |
| XAG/USD (Silver) | $0.01 | 23.50 → 23.51 = 1 pip |
| XTI/USD (Oil) | $0.01 | 78.50 → 78.51 = 1 pip |

### Session Recommendations

The analysis suggests optimal trading sessions:
- **London Session**: 08:00-17:00 GMT (best for EUR, GBP, CHF)
- **New York Session**: 13:00-22:00 GMT (best for USD pairs)
- **Asian Session**: 00:00-09:00 GMT (best for JPY, AUD, NZD)
- **London-NY Overlap**: 13:00-17:00 GMT (highest volatility)

### News Warnings

High-impact economic events that could affect your trade:
- Events listed with times
- Risk level assessment
- When to avoid trading

---

## Order Types Explained

### Forex Order Types

| Order Type | When to Use | Example |
|------------|-------------|---------|
| **BUY LIMIT** | Buy below current price (expect bounce from support) | Current: 1.0850, Entry: 1.0820 |
| **BUY STOP** | Buy above current price (breakout trade) | Current: 1.0850, Entry: 1.0880 |
| **SELL LIMIT** | Sell above current price (expect rejection from resistance) | Current: 1.0850, Entry: 1.0880 |
| **SELL STOP** | Sell below current price (breakdown trade) | Current: 1.0850, Entry: 1.0820 |
| **MARKET** | Enter immediately at current price | Current price = Entry |

### Options Order Types

| Order Type | Description |
|------------|-------------|
| **Buy to Open** | Purchase an option to open a new position |
| **Sell to Open** | Write/sell an option (collect premium) |
| **Buy to Close** | Close a short option position |
| **Sell to Close** | Close a long option position |

---

## Risk Management

### Position Sizing

The analysis suggests **0.5-1% risk per trade**. This means:
- If your account is $10,000
- Risk per trade = $50-100
- Calculate lot size based on SL distance

### Forex Position Size Formula

```
Lot Size = (Account Risk $) / (SL in Pips × Pip Value)
```

Example for EUR/USD:
- Account: $10,000
- Risk: 1% = $100
- SL: 30 pips
- Pip value (standard lot): $10/pip
- Lot Size = $100 / (30 × $10) = 0.33 lots

### Managing Take Profits

Recommended approach:
1. **At TP1**: Close 50% of position, move SL to breakeven
2. **At TP2**: Close 30% of remaining position
3. **At TP3**: Close final 20%

### When NOT to Trade

The AI will recommend "Wait" when:
- Confidence is below 55-60%
- High-impact news within 4 hours
- Conflicting signals across indicators
- Risk-to-reward below 2:1
- Price is in the middle of a range (no clear level)

**Trust the "Wait" recommendation** - it protects your capital.

---

## Best Practices

### Before Analysis

1. **Know your trading style**: Scalp, day trade, or swing?
2. **Set your risk tolerance**: How much can you afford to lose?
3. **Check your available capital**: Don't over-leverage
4. **Note the current session**: Is it active for your pair?

### During Analysis

1. **Use Additional Context**: Be specific about your needs
2. **Review all sections**: Don't just look at buy/sell
3. **Check the confidence level**: Higher is better
4. **Note the risks listed**: Every trade has risks

### After Analysis

1. **Verify the setup**: Does it match your trading plan?
2. **Set alerts**: Don't stare at charts all day
3. **Use proper position sizing**: Never risk more than planned
4. **Set SL/TP immediately**: Don't trade without protection

### General Tips

- **Don't chase trades**: If you missed the entry, wait for the next setup
- **Respect the SL**: Never move it further away
- **Take partial profits**: Lock in gains at TP1
- **Journal your trades**: Track what works and what doesn't
- **Avoid revenge trading**: One loss shouldn't lead to more

---

## Troubleshooting

### "Something went wrong" Error

This usually means:
- The AI couldn't complete the analysis
- Network issues occurred
- Try again in a few seconds

### Analysis Takes Too Long

The AI makes 6-8 tool calls to gather data. Normal time is 30-60 seconds.
If it takes longer:
- The data providers may be slow
- Try again during market hours for better data

### No Trade Setup Shown

If the analysis completes but shows no forex_setup:
- The AI didn't find a valid trading opportunity
- Entry conditions aren't met
- This is protective - it won't fabricate bad trades

### Invalid Symbol Error

- **Stocks**: Use US ticker symbols only (AAPL, not AAPL.US)
- **Forex**: Use standard pairs (EUR/USD, not EURO/DOLLAR)
- **Commodities**: Use forex mode for XAU/USD, XAG/USD

### Mismatch Warning

If you see "looks like a forex pair but you selected Stock Analysis":
- Switch to the correct analysis type
- Forex pairs need Forex Analysis
- Stock tickers need Stock Analysis

---

## Quick Reference

### Confidence Levels

| Level | Meaning | Action |
|-------|---------|--------|
| 85-95% | Strong confluence | Trade with full size |
| 70-84% | Good setup | Trade with normal size |
| 55-69% | Mixed signals | Trade with reduced size |
| Below 55% | No edge | Don't trade (Wait) |

### Pip Ranges by Instrument

| Instrument | SL Range | TP1 | TP2 | TP3 |
|------------|----------|-----|-----|-----|
| EUR/USD, GBP/USD | 20-50 pips | 25+ | 50+ | 75+ |
| USD/JPY | 20-50 pips | 25+ | 50+ | 75+ |
| XAU/USD (Gold) | 30-80 pips | 50+ | 100+ | 150+ |
| XAG/USD (Silver) | 30-80 pips | 50+ | 100+ | 150+ |
| XTI/USD (Oil) | 30-80 pips | 50+ | 100+ | 150+ |

### Risk-Reward Requirements

| Target | Minimum R:R |
|--------|-------------|
| TP1 | 1:1 |
| TP2 | 2:1 |
| TP3 | 3:1 |

---

## Support

For issues or feedback:
- GitHub: [Report Issues](https://github.com/anthropics/claude-code/issues)
- Check the analysis history for past recommendations

---

*This guide is for educational purposes. Always do your own research and never risk more than you can afford to lose.*
