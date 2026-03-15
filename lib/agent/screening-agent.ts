import Anthropic from '@anthropic-ai/sdk';
import { withAITracking } from '@/lib/ai-metrics';
import { getModelConfig } from '@/lib/ai/models';
import { extractJson } from '@/lib/ai/extractors';
import { buildScreeningPrompt } from '@/lib/ai/prompts/screening';
import type { ScreeningDecision } from '@/lib/types';

interface ScreeningInput {
  application: {
    full_name: string;
    credit_score_range: string;
    monthly_income: number;
    employer_name: string | null;
    employment_duration_months: number | null;
    employment_type: string | null;
    years_renting: number;
    previous_evictions: boolean;
    references: { name: string; phone: string; relationship: string }[];
    social_media_links?: string[]; // kept for interface compat, never sent to AI
  };
  property: {
    address: string;
    monthly_rent: number;
  };
}

const FALLBACK_DECISION: ScreeningDecision = {
  approved: false,
  reasoning: 'Failed to parse AI screening response',
  risk_score: 100,
  income_ratio: 0,
  flags: ['parse_error'],
  confidence: 0,
  social_media_notes: null,
};

const client = new Anthropic();

export async function screenApplication(input: ScreeningInput): Promise<ScreeningDecision> {
  const incomeRatio = input.property.monthly_rent > 0
    ? input.application.monthly_income / input.property.monthly_rent
    : 0;

  const prompt = buildScreeningPrompt({
    fullName: input.application.full_name,
    creditScoreRange: input.application.credit_score_range,
    monthlyIncome: input.application.monthly_income,
    employerName: input.application.employer_name,
    employmentDurationMonths: input.application.employment_duration_months,
    employmentType: input.application.employment_type,
    yearsRenting: input.application.years_renting,
    previousEvictions: input.application.previous_evictions,
    references: input.application.references,
    socialMediaLinks: input.application.social_media_links,
    propertyAddress: input.property.address,
    monthlyRent: input.property.monthly_rent,
    incomeRatio,
  });

  const modelConfig = getModelConfig('screening');

  const response = await withAITracking(
    { service: 'screening-agent', endpoint: 'application-screening' },
    () =>
      client.messages.create({
        model: modelConfig.model,
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
  );

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = extractJson<ScreeningDecision | null>(text, null);
  if (!parsed) {
    return FALLBACK_DECISION;
  }
  return {
    ...parsed,
    income_ratio: incomeRatio,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    risk_score: Math.max(0, Math.min(100, parsed.risk_score)),
    social_media_notes: null, // Fair Housing: never include social media analysis
  };
}
