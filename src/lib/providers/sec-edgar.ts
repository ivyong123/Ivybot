// SEC EDGAR API for insider trading and institutional holdings
// Free, no API key required

import { InsiderTrade, InstitutionalHolding } from '@/types/market-data';

const SEC_BASE_URL = 'https://data.sec.gov';

// SEC requires a User-Agent header with contact info
const SEC_HEADERS = {
  'User-Agent': 'CheekyTrader/1.0 (contact@cheekytrader.com)',
  'Accept': 'application/json',
};

// Get company CIK (Central Index Key) from ticker
async function getCompanyCIK(symbol: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${SEC_BASE_URL}/files/company_tickers.json`,
      { headers: SEC_HEADERS }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const upperSymbol = symbol.toUpperCase();

    // Find the company by ticker
    for (const key of Object.keys(data)) {
      if (data[key].ticker === upperSymbol) {
        // CIK needs to be padded to 10 digits
        return String(data[key].cik_str).padStart(10, '0');
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to get CIK:', error);
    return null;
  }
}

// Get insider trading data (Form 4 filings)
export async function getInsiderTrades(symbol: string): Promise<{
  symbol: string;
  trades: InsiderTrade[];
  summary: {
    total_buys: number;
    total_sells: number;
    net_shares: number;
    buy_value: number;
    sell_value: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
  };
}> {
  const upperSymbol = symbol.toUpperCase();

  try {
    const cik = await getCompanyCIK(upperSymbol);
    if (!cik) {
      return {
        symbol: upperSymbol,
        trades: [],
        summary: {
          total_buys: 0,
          total_sells: 0,
          net_shares: 0,
          buy_value: 0,
          sell_value: 0,
          sentiment: 'neutral',
        },
      };
    }

    // Get company filings
    const response = await fetch(
      `${SEC_BASE_URL}/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4&dateb=&owner=only&count=40&output=atom`,
      { headers: SEC_HEADERS }
    );

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status}`);
    }

    const text = await response.text();

    // Parse the Atom feed for Form 4 filings
    const trades: InsiderTrade[] = [];
    let totalBuys = 0;
    let totalSells = 0;
    let netShares = 0;
    let buyValue = 0;
    let sellValue = 0;

    // Extract entries from Atom feed using regex (simplified parsing)
    const entryMatches = text.matchAll(/<entry>([\s\S]*?)<\/entry>/g);

    for (const match of entryMatches) {
      const entry = match[1];

      // Extract title (contains insider name and transaction type)
      const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const dateMatch = entry.match(/<updated>([\s\S]*?)<\/updated>/);
      const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/);

      if (titleMatch && dateMatch) {
        const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
        const date = dateMatch[1].trim();

        // Parse the title to extract transaction details
        // Format is usually: "4 - INSIDER NAME - TRANSACTION TYPE"
        const parts = title.split(' - ');
        if (parts.length >= 2) {
          const insiderName = parts[1] || 'Unknown';

          // Determine if it's a buy or sell based on common patterns
          const isBuy = title.toLowerCase().includes('acquisition') ||
                       title.toLowerCase().includes('purchase') ||
                       title.toLowerCase().includes('award') ||
                       title.toLowerCase().includes('exercise');
          const isSell = title.toLowerCase().includes('disposition') ||
                        title.toLowerCase().includes('sale');

          const trade: InsiderTrade = {
            symbol: upperSymbol,
            insider_name: insiderName,
            insider_title: 'Officer/Director',
            transaction_date: date.split('T')[0],
            transaction_type: isBuy ? 'buy' : isSell ? 'sell' : 'other',
            shares: 0, // Would need to parse the actual filing for this
            price: 0,
            value: 0,
            shares_owned_after: 0,
            filing_url: linkMatch ? linkMatch[1] : undefined,
          };

          trades.push(trade);

          if (isBuy) totalBuys++;
          if (isSell) totalSells++;
        }
      }

      // Limit to recent trades
      if (trades.length >= 20) break;
    }

    // Determine sentiment
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (totalBuys > totalSells * 1.5) {
      sentiment = 'bullish';
    } else if (totalSells > totalBuys * 1.5) {
      sentiment = 'bearish';
    }

    return {
      symbol: upperSymbol,
      trades,
      summary: {
        total_buys: totalBuys,
        total_sells: totalSells,
        net_shares: netShares,
        buy_value: buyValue,
        sell_value: sellValue,
        sentiment,
      },
    };
  } catch (error) {
    console.error('Failed to get insider trades:', error);
    return {
      symbol: upperSymbol,
      trades: [],
      summary: {
        total_buys: 0,
        total_sells: 0,
        net_shares: 0,
        buy_value: 0,
        sell_value: 0,
        sentiment: 'neutral',
      },
    };
  }
}

// Get institutional holdings (13F filings)
export async function getInstitutionalHoldings(symbol: string): Promise<{
  symbol: string;
  holders: InstitutionalHolding[];
  summary: {
    total_institutions: number;
    total_shares_held: number;
    increased_positions: number;
    decreased_positions: number;
    new_positions: number;
    sentiment: 'accumulating' | 'distributing' | 'neutral';
  };
}> {
  const upperSymbol = symbol.toUpperCase();

  try {
    // For institutional holdings, we'll use a different approach
    // SEC's full-text search for 13F filings mentioning the company
    const cik = await getCompanyCIK(upperSymbol);

    if (!cik) {
      return {
        symbol: upperSymbol,
        holders: [],
        summary: {
          total_institutions: 0,
          total_shares_held: 0,
          increased_positions: 0,
          decreased_positions: 0,
          new_positions: 0,
          sentiment: 'neutral',
        },
      };
    }

    // Get company facts which includes institutional ownership data
    const response = await fetch(
      `${SEC_BASE_URL}/submissions/CIK${cik}.json`,
      { headers: SEC_HEADERS }
    );

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract recent 13F-HR filings from the company's filings
    const filings = data.filings?.recent || {};
    const forms = filings.form || [];
    const dates = filings.filingDate || [];
    const accessions = filings.accessionNumber || [];

    const holders: InstitutionalHolding[] = [];
    let increased = 0;
    let decreased = 0;
    let newPositions = 0;

    // Look for institutional ownership references
    // Note: This is simplified - full 13F parsing would require fetching individual filings
    for (let i = 0; i < Math.min(forms.length, 50); i++) {
      if (forms[i] === '13F-HR' || forms[i] === '13F-HR/A') {
        // This is an institutional filing about the company
        holders.push({
          symbol: upperSymbol,
          institution_name: data.name || 'Unknown Institution',
          shares: 0,
          value: 0,
          percent_of_portfolio: 0,
          percent_of_shares_outstanding: 0,
          change_in_shares: 0,
          change_percent: 0,
          filing_date: dates[i],
          quarter: dates[i]?.substring(0, 7) || 'Unknown',
        });
      }
    }

    // Determine sentiment based on position changes
    let sentiment: 'accumulating' | 'distributing' | 'neutral' = 'neutral';
    if (increased > decreased * 1.3) {
      sentiment = 'accumulating';
    } else if (decreased > increased * 1.3) {
      sentiment = 'distributing';
    }

    return {
      symbol: upperSymbol,
      holders,
      summary: {
        total_institutions: holders.length,
        total_shares_held: 0,
        increased_positions: increased,
        decreased_positions: decreased,
        new_positions: newPositions,
        sentiment,
      },
    };
  } catch (error) {
    console.error('Failed to get institutional holdings:', error);
    return {
      symbol: upperSymbol,
      holders: [],
      summary: {
        total_institutions: 0,
        total_shares_held: 0,
        increased_positions: 0,
        decreased_positions: 0,
        new_positions: 0,
        sentiment: 'neutral',
      },
    };
  }
}
