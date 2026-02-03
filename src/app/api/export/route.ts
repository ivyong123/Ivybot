import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TradeRecommendation } from '@/types/analysis';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from 'docx';

function createReportDocument(job: {
  symbol: string;
  analysis_type: string;
  created_at: string;
  final_result: TradeRecommendation | null;
}): Document {
  const result = job.final_result;
  const date = new Date(job.created_at).toLocaleString();

  if (!result) {
    return new Document({
      sections: [{
        children: [
          new Paragraph({
            text: 'No analysis results available.',
            heading: HeadingLevel.HEADING_1,
          }),
        ],
      }],
    });
  }

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'CHEEKYTRADER AI',
          bold: true,
          size: 32,
          color: '7C3AED',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'TRADING ANALYSIS REPORT',
          bold: true,
          size: 28,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Basic Info
  children.push(
    new Paragraph({
      text: 'Report Details',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Symbol: ', bold: true }),
        new TextRun({ text: result.symbol }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Analysis Type: ', bold: true }),
        new TextRun({ text: result.analysis_type.toUpperCase() }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Generated: ', bold: true }),
        new TextRun({ text: date }),
      ],
      spacing: { after: 400 },
    })
  );

  // Recommendation Summary
  const recColor = result.recommendation.includes('buy') ? '10B981' :
                   result.recommendation.includes('sell') ? 'EF4444' : 'F59E0B';

  children.push(
    new Paragraph({
      text: 'Recommendation Summary',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Recommendation: ', bold: true }),
        new TextRun({
          text: result.recommendation.toUpperCase().replace('_', ' '),
          bold: true,
          color: recColor,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Confidence: ', bold: true }),
        new TextRun({ text: `${result.confidence}%` }),
      ],
      spacing: { after: 100 },
    })
  );

  // Price Levels
  if (result.entry_price || result.price_target || result.stop_loss) {
    children.push(
      new Paragraph({
        text: 'Price Levels',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );

    if (result.entry_price) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Entry Price: ', bold: true }),
          new TextRun({ text: `$${result.entry_price.toFixed(2)}` }),
        ],
        spacing: { after: 100 },
      }));
    }
    if (result.price_target) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Price Target: ', bold: true }),
          new TextRun({ text: `$${result.price_target.toFixed(2)}`, color: '10B981' }),
        ],
        spacing: { after: 100 },
      }));
    }
    if (result.stop_loss) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Stop Loss: ', bold: true }),
          new TextRun({ text: `$${result.stop_loss.toFixed(2)}`, color: 'EF4444' }),
        ],
        spacing: { after: 100 },
      }));
    }
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Timeframe: ', bold: true }),
        new TextRun({ text: result.timeframe }),
      ],
      spacing: { after: 200 },
    }));
  }

  // Analysis
  children.push(
    new Paragraph({
      text: 'Analysis',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      text: result.reasoning,
      spacing: { after: 400 },
    })
  );

  // Key Factors
  if (result.key_factors && result.key_factors.length > 0) {
    children.push(
      new Paragraph({
        text: 'Key Factors',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    result.key_factors.forEach((factor, index) => {
      const sentimentColor = factor.sentiment === 'bullish' ? '10B981' :
                            factor.sentiment === 'bearish' ? 'EF4444' : 'F59E0B';
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${index + 1}. `, bold: true }),
            new TextRun({ text: factor.factor }),
          ],
          spacing: { after: 50 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '   Sentiment: ', italics: true }),
            new TextRun({ text: factor.sentiment.toUpperCase(), color: sentimentColor, bold: true }),
            new TextRun({ text: ` | Weight: ${factor.weight}% | Source: ${factor.source}` }),
          ],
          spacing: { after: 150 },
        })
      );
    });
  }

  // Risks
  if (result.risks && result.risks.length > 0) {
    children.push(
      new Paragraph({
        text: 'Key Risks',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    result.risks.forEach((risk, index) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${index + 1}. `, bold: true }),
          new TextRun({ text: risk }),
        ],
        spacing: { after: 100 },
      }));
    });
  }

  // Options Strategy
  if (result.options_strategy) {
    const strategy = result.options_strategy;
    children.push(
      new Paragraph({
        text: `Options Strategy: ${strategy.strategy_type?.toUpperCase().replace('_', ' ') || 'N/A'}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    if (strategy.legs && strategy.legs.length > 0) {
      strategy.legs.forEach((leg, index) => {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `Leg ${index + 1}: `, bold: true }),
            new TextRun({
              text: `${leg.action.toUpperCase()} ${leg.quantity}x ${leg.option_type.toUpperCase()} $${leg.strike} exp ${leg.expiration}`
            }),
          ],
          spacing: { after: 100 },
        }));
      });
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Max Profit: ', bold: true }),
          new TextRun({
            text: strategy.max_profit ? `$${strategy.max_profit.toFixed(2)}` : 'Unlimited/Unknown',
            color: '10B981'
          }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Max Loss: ', bold: true }),
          new TextRun({
            text: strategy.max_loss ? `$${strategy.max_loss.toFixed(2)}` : 'Unlimited/Unknown',
            color: 'EF4444'
          }),
        ],
        spacing: { after: 100 },
      })
    );

    if (strategy.breakeven) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Breakeven: ', bold: true }),
          new TextRun({ text: strategy.breakeven.join(', ') }),
        ],
        spacing: { after: 100 },
      }));
    }

    if (strategy.probability_of_profit) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Probability of Profit: ', bold: true }),
          new TextRun({ text: `${strategy.probability_of_profit}%` }),
        ],
        spacing: { after: 200 },
      }));
    }
  }

  // Data Sources
  if (result.data_sources && result.data_sources.length > 0) {
    children.push(
      new Paragraph({
        text: 'Data Sources',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),
      new Paragraph({
        text: result.data_sources.join(', '),
        spacing: { after: 400 },
      })
    );
  }

  // Disclaimer
  children.push(
    new Paragraph({
      text: 'Disclaimer',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'This analysis is provided for educational and informational purposes only. It does not constitute financial advice, investment advice, or any other type of advice. Trading stocks, options, and forex involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. Always do your own research and consult with a qualified financial advisor before making any investment decisions.',
          italics: true,
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Generated by CheekyTrader AI',
          bold: true,
          color: '7C3AED',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
    })
  );

  return new Document({
    sections: [{
      properties: {},
      children,
    }],
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const format = searchParams.get('format') || 'docx';

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const { data: job, error } = await supabase
      .from('trading_analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const filename = `${job.symbol}_analysis_${new Date(job.created_at).toISOString().split('T')[0]}`;

    if (format === 'txt') {
      // Plain text fallback
      const content = generateTextContent(job);
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.txt"`,
        },
      });
    }

    // Generate Word document
    const doc = createReportDocument(job);
    const buffer = await Packer.toBuffer(doc);
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      },
    });
  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateTextContent(job: {
  symbol: string;
  analysis_type: string;
  created_at: string;
  final_result: TradeRecommendation | null;
}): string {
  const result = job.final_result;
  if (!result) return 'No analysis results available.';

  const date = new Date(job.created_at).toLocaleString();

  let content = `CHEEKYTRADER AI - TRADING ANALYSIS REPORT
${'='.repeat(50)}

Symbol: ${result.symbol}
Analysis Type: ${result.analysis_type.toUpperCase()}
Generated: ${date}

${'='.repeat(50)}
RECOMMENDATION SUMMARY
${'='.repeat(50)}

Recommendation: ${result.recommendation.toUpperCase().replace('_', ' ')}
Confidence: ${result.confidence}%
Entry Price: ${result.entry_price ? `$${result.entry_price}` : 'N/A'}
Price Target: ${result.price_target ? `$${result.price_target}` : 'N/A'}
Stop Loss: ${result.stop_loss ? `$${result.stop_loss}` : 'N/A'}
Timeframe: ${result.timeframe}

${'='.repeat(50)}
ANALYSIS
${'='.repeat(50)}

${result.reasoning}

`;

  if (result.key_factors && result.key_factors.length > 0) {
    content += `${'='.repeat(50)}
KEY FACTORS
${'='.repeat(50)}

`;
    result.key_factors.forEach((factor, index) => {
      content += `${index + 1}. ${factor.factor}
   Sentiment: ${factor.sentiment.toUpperCase()} | Weight: ${factor.weight}% | Source: ${factor.source}

`;
    });
  }

  if (result.risks && result.risks.length > 0) {
    content += `${'='.repeat(50)}
RISKS
${'='.repeat(50)}

`;
    result.risks.forEach((risk, index) => {
      content += `${index + 1}. ${risk}\n`;
    });
  }

  content += `
${'='.repeat(50)}
DISCLAIMER
${'='.repeat(50)}

This analysis is provided for educational and informational purposes only.
Generated by CheekyTrader AI
`;

  return content;
}
