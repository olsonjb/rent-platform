import Anthropic from '@anthropic-ai/sdk';
import { withAITracking } from '@/lib/ai-metrics';
import { getModelConfig } from '@/lib/ai/models';
import { extractJson } from '@/lib/ai/extractors';
import type { RenewalEvaluation } from '@/lib/types';

const client = new Anthropic();

interface RenewalOfferInput {
  evaluation: RenewalEvaluation;
  lease: {
    start_date: string;
    end_date: string;
    monthly_rent: number;
  };
  tenant: {
    name: string;
  };
  property: {
    address: string;
    city: string | null;
    state: string | null;
  };
  newEndDate: string;
  newRent: number;
}

interface GeneratedOffer {
  offer_letter: string;
}

export async function generateRenewalOffer(input: RenewalOfferInput): Promise<string> {
  const prompt = buildRenewalOfferPrompt(input);
  const modelConfig = getModelConfig('renewal');

  const response = await withAITracking(
    { service: 'renewal-agent', endpoint: 'offer-generation' },
    () =>
      client.messages.create({
        model: modelConfig.model,
        max_tokens: modelConfig.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
  );

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = extractJson<GeneratedOffer>(text, { offer_letter: '' });

  if (parsed.offer_letter) {
    return parsed.offer_letter;
  }

  // If JSON extraction fails, use the raw text as the letter
  return text || buildFallbackOffer(input);
}

function buildRenewalOfferPrompt(input: RenewalOfferInput): string {
  const tenureMonths = Math.round(
    (new Date(input.lease.end_date).getTime() - new Date(input.lease.start_date).getTime()) /
      (1000 * 60 * 60 * 24 * 30),
  );

  const rentChange = input.newRent - input.lease.monthly_rent;
  const rentChangeDesc =
    rentChange === 0
      ? 'same rent'
      : rentChange > 0
        ? `$${rentChange}/month increase`
        : `$${Math.abs(rentChange)}/month decrease`;

  return `You are a property management assistant generating a lease renewal offer letter.

TENANT: ${input.tenant.name}
PROPERTY: ${input.property.address}, ${input.property.city ?? ''}, ${input.property.state ?? ''}
CURRENT LEASE: ${input.lease.start_date} to ${input.lease.end_date} (${tenureMonths} months)
CURRENT RENT: $${input.lease.monthly_rent}/month
NEW RENT: $${input.newRent}/month (${rentChangeDesc})
NEW LEASE END: ${input.newEndDate}
RESPONSE DEADLINE: 14 days from receipt

Write a professional but warm renewal offer letter. Include:
1. Acknowledge their tenancy and how long they've been a tenant
2. Present the new terms (rent, lease end date)
3. If rent is changing, briefly explain why (market adjustment)
4. Clear deadline to respond (14 days)
5. Instructions: "Reply to accept or decline this renewal offer"
6. Warm closing

Respond with a JSON object:
{
  "offer_letter": "<the complete letter text>"
}`;
}

function buildFallbackOffer(input: RenewalOfferInput): string {
  return `Dear ${input.tenant.name},

We hope you've been enjoying your time at ${input.property.address}. As your current lease is approaching its end date of ${input.lease.end_date}, we'd like to offer you the opportunity to renew.

New Terms:
- Monthly Rent: $${input.newRent}
- Lease End Date: ${input.newEndDate}

Please respond within 14 days to accept or decline this renewal offer.

We value you as a tenant and look forward to continuing our relationship.

Best regards,
Property Management`;
}
