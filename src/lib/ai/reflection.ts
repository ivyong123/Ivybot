import { chatCompletion } from './openrouter-client';
import { ChatMessage, AnalysisCritique, ReflectionResult } from '@/types/ai';

const CRITIQUE_SYSTEM_PROMPT = `You are a senior trading analyst reviewing another analyst's work. Your role is to critically evaluate the analysis and identify:

1. **Strengths**: What aspects of the analysis are well-done?
2. **Weaknesses**: What could be improved or is missing?
3. **Missing Data**: What additional data would strengthen the analysis?
4. **Confidence Assessment**: On a scale of 0-100, how confident should we be in this analysis?
5. **Recommendations**: Specific suggestions for improvement

Be constructive but thorough. Focus on:
- Data completeness (are all relevant factors considered?)
- Logic soundness (do the conclusions follow from the data?)
- Risk assessment (are risks properly identified?)
- Actionability (is the recommendation clear and executable?)

Respond in JSON format:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "missing_data": ["..."],
  "confidence_assessment": 0-100,
  "recommendations": ["..."],
  "should_refine": true/false
}`;

const REFINEMENT_SYSTEM_PROMPT = `You are refining a trading analysis based on critique feedback. Your task is to:

1. Address the identified weaknesses
2. Incorporate any additional insights
3. Adjust confidence levels based on data quality
4. Improve the clarity and actionability of recommendations

Maintain the same format as the original analysis but make it stronger based on the feedback.`;

// Perform self-critique on an analysis
export async function critiqueAnalysis(
  analysis: string,
  gatheredData: Record<string, unknown>
): Promise<AnalysisCritique> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: CRITIQUE_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `Please critique the following trading analysis.

## Analysis to Review:
${analysis}

## Data Sources Used:
${Object.keys(gatheredData).join(', ')}

## Raw Data Summary:
${summarizeData(gatheredData)}

Provide your critique in JSON format.`,
    },
  ];

  const response = await chatCompletion(messages, {
    taskType: 'reflection',
    maxTokens: 2048,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No critique generated');
  }

  try {
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in critique response');
    }
    return JSON.parse(jsonMatch[0]) as AnalysisCritique;
  } catch (error) {
    console.error('Failed to parse critique:', error);
    // Return a default critique if parsing fails
    return {
      strengths: ['Analysis was generated'],
      weaknesses: ['Critique parsing failed'],
      missing_data: [],
      confidence_assessment: 50,
      recommendations: ['Re-run analysis'],
      should_refine: false,
    };
  }
}

// Refine analysis based on critique
export async function refineAnalysis(
  originalAnalysis: string,
  critique: AnalysisCritique,
  gatheredData: Record<string, unknown>
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: REFINEMENT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `Please refine this trading analysis based on the critique feedback.

## Original Analysis:
${originalAnalysis}

## Critique Feedback:
### Strengths:
${critique.strengths.map((s) => `- ${s}`).join('\n')}

### Weaknesses to Address:
${critique.weaknesses.map((w) => `- ${w}`).join('\n')}

### Missing Data (if available, incorporate):
${critique.missing_data.map((d) => `- ${d}`).join('\n')}

### Recommendations:
${critique.recommendations.map((r) => `- ${r}`).join('\n')}

### Confidence Assessment: ${critique.confidence_assessment}/100

## Available Data:
${summarizeData(gatheredData)}

Please provide an improved analysis that addresses the feedback.`,
    },
  ];

  const response = await chatCompletion(messages, {
    taskType: 'reflection',
    maxTokens: 4096,
  });

  return response.choices[0]?.message?.content || originalAnalysis;
}

// Main reflection loop
export async function performReflection(
  initialAnalysis: string,
  gatheredData: Record<string, unknown>,
  maxIterations: number = 2
): Promise<ReflectionResult> {
  let currentAnalysis = initialAnalysis;
  let iterations = 0;
  let lastCritique: AnalysisCritique | null = null;

  while (iterations < maxIterations) {
    // Critique the current analysis
    const critique = await critiqueAnalysis(currentAnalysis, gatheredData);
    lastCritique = critique;
    iterations++;

    // If confidence is high enough or no refinement needed, stop
    if (!critique.should_refine || critique.confidence_assessment >= 80) {
      break;
    }

    // Refine the analysis
    currentAnalysis = await refineAnalysis(currentAnalysis, critique, gatheredData);
  }

  return {
    initial_analysis: initialAnalysis,
    critique: lastCritique || {
      strengths: [],
      weaknesses: [],
      missing_data: [],
      confidence_assessment: 50,
      recommendations: [],
      should_refine: false,
    },
    refined_analysis: iterations > 1 ? currentAnalysis : null,
    iterations,
  };
}

// Helper to summarize gathered data for context
function summarizeData(data: Record<string, unknown>): string {
  const summaries: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object') {
      // Summarize complex objects
      const keys = Object.keys(value as Record<string, unknown>);
      summaries.push(`${key}: {${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}}`);
    } else {
      summaries.push(`${key}: ${String(value).slice(0, 100)}`);
    }
  }

  return summaries.join('\n');
}
