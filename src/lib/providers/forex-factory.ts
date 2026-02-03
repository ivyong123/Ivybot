// Forex Factory Economic Calendar Scraper
import * as cheerio from 'cheerio';

const FOREX_FACTORY_URL = 'https://www.forexfactory.com/calendar';

export interface EconomicEvent {
  date: string;
  time: string;
  currency: string;
  impact: 'high' | 'medium' | 'low' | 'holiday';
  event: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  timestamp: Date | null;
}

export interface CalendarResult {
  ticker: string;
  currencies: string[];
  currentDate: string;
  summary: {
    totalRelevantEvents: number;
    highImpact: number;
    mediumImpact: number;
    lowImpact: number;
    todayHighImpact: number;
  };
  tradingGuidance: {
    riskLevel: 'High' | 'Elevated' | 'Moderate' | 'Normal';
    recommendation: string;
    warnings: string[];
    avoidTradingAround: Array<{
      event: string;
      currency: string;
      datetime: string;
      impact: string;
    }>;
  };
  todayEvents: EconomicEvent[];
  upcomingImportant: EconomicEvent[];
  allEventsByImpact: {
    high: EconomicEvent[];
    medium: EconomicEvent[];
    low: EconomicEvent[];
  };
}

function getHeaders(): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
  };
}

// Parse impact level from class name
function parseImpact(impactClass: string): 'high' | 'medium' | 'low' | 'holiday' {
  if (impactClass.includes('high') || impactClass.includes('red')) return 'high';
  if (impactClass.includes('medium') || impactClass.includes('ora')) return 'medium';
  if (impactClass.includes('low') || impactClass.includes('yel')) return 'low';
  if (impactClass.includes('holiday') || impactClass.includes('gra')) return 'holiday';
  return 'low';
}

// Scrape Forex Factory calendar
export async function scrapeForexFactoryCalendar(): Promise<EconomicEvent[]> {
  try {
    const response = await fetch(FOREX_FACTORY_URL, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Forex Factory error: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const events: EconomicEvent[] = [];

    let currentDate = '';

    // Parse calendar table rows
    $('tr.calendar__row').each((_, row) => {
      const $row = $(row);

      // Check for date row
      const dateCell = $row.find('.calendar__date span');
      if (dateCell.length > 0) {
        const dateText = dateCell.text().trim();
        if (dateText) {
          currentDate = dateText;
        }
      }

      // Get event data
      const currency = $row.find('.calendar__currency').text().trim();
      const impactCell = $row.find('.calendar__impact span');
      const impactClass = impactCell.attr('class') || '';
      const eventName = $row.find('.calendar__event span').text().trim();
      const time = $row.find('.calendar__time').text().trim();
      const actual = $row.find('.calendar__actual').text().trim() || null;
      const forecast = $row.find('.calendar__forecast').text().trim() || null;
      const previous = $row.find('.calendar__previous').text().trim() || null;

      if (currency && eventName) {
        events.push({
          date: currentDate,
          time: time || 'All Day',
          currency: currency.toUpperCase(),
          impact: parseImpact(impactClass),
          event: eventName,
          actual,
          forecast,
          previous,
          timestamp: null,
        });
      }
    });

    return events;
  } catch (error) {
    console.error('Forex Factory scrape error:', error);
    return [];
  }
}

// Alternative: Use free API for economic calendar
export async function getEconomicCalendarAPI(): Promise<EconomicEvent[]> {
  // Try using Forex Factory's JSON endpoint (unofficial)
  try {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Format dates
    const formatDate = (d: Date) => {
      const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][d.getMonth()];
      return `${month}${d.getDate()}.${d.getFullYear()}`;
    };

    const url = `https://nfs.faireconomy.media/ff_calendar_thisweek.json`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();

    return (data || []).map((event: any) => ({
      date: event.date || '',
      time: event.time || 'All Day',
      currency: (event.country || '').toUpperCase(),
      impact: event.impact === 'High' ? 'high' :
              event.impact === 'Medium' ? 'medium' :
              event.impact === 'Low' ? 'low' : 'low',
      event: event.title || '',
      actual: event.actual || null,
      forecast: event.forecast || null,
      previous: event.previous || null,
      timestamp: event.date ? new Date(event.date) : null,
    }));
  } catch (error) {
    console.error('Economic calendar API error:', error);
    // Fallback to scraping
    return scrapeForexFactoryCalendar();
  }
}

// Get calendar data filtered for a specific forex pair
export async function getForexCalendar(pair: string): Promise<CalendarResult> {
  // Extract currencies from pair (e.g., "EUR/USD" -> ["EUR", "USD"])
  const currencies: string[] = pair.toUpperCase().replace('/', '').match(/.{3}/g) || [];

  const allEvents = await getEconomicCalendarAPI();

  // Filter events for relevant currencies
  const relevantEvents = allEvents.filter(e =>
    currencies.includes(e.currency)
  );

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Categorize events
  const todayEvents = relevantEvents.filter(e => {
    if (!e.timestamp) return false;
    return e.timestamp.toISOString().split('T')[0] === todayStr;
  });

  const highImpactEvents = relevantEvents.filter(e => e.impact === 'high');
  const mediumImpactEvents = relevantEvents.filter(e => e.impact === 'medium');
  const lowImpactEvents = relevantEvents.filter(e => e.impact === 'low');

  const todayHighImpact = todayEvents.filter(e => e.impact === 'high');

  // Determine risk level
  let riskLevel: 'High' | 'Elevated' | 'Moderate' | 'Normal' = 'Normal';
  let recommendation = 'Normal trading conditions';
  const warnings: string[] = [];
  const avoidTradingAround: Array<{ event: string; currency: string; datetime: string; impact: string }> = [];

  if (todayHighImpact.length > 0) {
    riskLevel = 'High';
    recommendation = 'High-impact news today - exercise extreme caution or avoid trading';
    todayHighImpact.forEach(e => {
      warnings.push(`${e.event} (${e.currency}) - ${e.time}`);
      avoidTradingAround.push({
        event: e.event,
        currency: e.currency,
        datetime: `${e.date} ${e.time}`,
        impact: 'High',
      });
    });
  } else if (highImpactEvents.length > 0) {
    riskLevel = 'Elevated';
    recommendation = 'High-impact news upcoming this week - be cautious around release times';
    highImpactEvents.slice(0, 3).forEach(e => {
      warnings.push(`${e.event} (${e.currency}) - ${e.date} at ${e.time}`);
      avoidTradingAround.push({
        event: e.event,
        currency: e.currency,
        datetime: `${e.date} ${e.time}`,
        impact: 'High',
      });
    });
  } else if (mediumImpactEvents.length > 2) {
    riskLevel = 'Moderate';
    recommendation = 'Multiple medium-impact events - consider reducing position size';
  }

  return {
    ticker: pair,
    currencies,
    currentDate: todayStr,
    summary: {
      totalRelevantEvents: relevantEvents.length,
      highImpact: highImpactEvents.length,
      mediumImpact: mediumImpactEvents.length,
      lowImpact: lowImpactEvents.length,
      todayHighImpact: todayHighImpact.length,
    },
    tradingGuidance: {
      riskLevel,
      recommendation,
      warnings,
      avoidTradingAround,
    },
    todayEvents,
    upcomingImportant: highImpactEvents.slice(0, 5),
    allEventsByImpact: {
      high: highImpactEvents,
      medium: mediumImpactEvents,
      low: lowImpactEvents,
    },
  };
}
