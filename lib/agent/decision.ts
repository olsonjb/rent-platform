import Anthropic from '@anthropic-ai/sdk';
import { withAITracking } from '@/lib/ai-metrics';
import { getModelConfig } from '@/lib/ai/models';
import { buildListingDecisionPrompt } from '@/lib/ai/prompts/listing-decision';
import type { AIDecision } from '@/lib/types';
export type { AIDecision };

interface DecisionInput {
  property: {
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    monthly_rent: number | null;
  };
  lease: {
    end_date: string;
    monthly_rent: number;
    tenant_name: string;
    renewal_offered: boolean;
  };
}

const client = new Anthropic();

export async function makeListingDecision(input: DecisionInput): Promise<AIDecision> {
  const daysLeft = Math.ceil(
    (new Date(input.lease.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const prompt = buildListingDecisionPrompt({
    propertyAddress: input.property.address,
    city: input.property.city,
    state: input.property.state,
    zip: input.property.zip,
    bedrooms: input.property.bedrooms,
    bathrooms: input.property.bathrooms,
    sqft: input.property.sqft,
    currentListedRent: input.property.monthly_rent ?? input.lease.monthly_rent,
    leaseMonthlyRent: input.lease.monthly_rent,
    daysLeft,
    leaseEndDate: input.lease.end_date,
    tenantName: input.lease.tenant_name,
    renewalOffered: input.lease.renewal_offered,
  });

  const modelConfig = getModelConfig('decision');

  const response = await withAITracking(
    { service: 'listing-agent', endpoint: 'listing-decision' },
    () =>
      client.messages.create({
        model: modelConfig.model,
        max_tokens: modelConfig.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
  );

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) {
    return { should_list: false, reasoning: 'Failed to parse AI response', suggested_rent: null, urgency: 'low' };
  }
  try {
    return JSON.parse(json) as AIDecision;
  } catch {
    return { should_list: false, reasoning: 'Failed to parse AI response', suggested_rent: null, urgency: 'low' };
  }
}
