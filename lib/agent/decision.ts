import Anthropic from '@anthropic-ai/sdk';

export interface AIDecision {
  should_list: boolean;
  reasoning: string;
  suggested_rent: number | null;
  urgency: 'high' | 'medium' | 'low';
}

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

  const prompt = `You are a property management AI. Decide whether to create a rental listing for this property.

Property:
- Address: ${input.property.address}
- Location: ${input.property.city ?? 'Unknown'}, ${input.property.state ?? 'Unknown'} ${input.property.zip ?? ''}
- Bedrooms: ${input.property.bedrooms ?? 'Unknown'}
- Bathrooms: ${input.property.bathrooms ?? 'Unknown'}
- Sqft: ${input.property.sqft ?? 'Unknown'}
- Current listed rent: $${input.property.monthly_rent ?? input.lease.monthly_rent}/mo

Lease:
- Current rent: $${input.lease.monthly_rent}/mo
- Expires in ${daysLeft} days (${input.lease.end_date})
- Tenant: ${input.lease.tenant_name}
- Renewal offered: ${input.lease.renewal_offered ? 'Yes' : 'No'}

Decide:
1. Should we create a listing? (Consider: days until expiry, whether renewal was offered)
2. What rent should we suggest? (Consider current rent, market positioning)
3. How urgent is this? (high = <14 days, medium = 14-21 days, low = 21+ days)

Respond with ONLY valid JSON:
{"should_list": boolean, "reasoning": "string", "suggested_rent": number, "urgency": "high"|"medium"|"low"}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) {
    return { should_list: false, reasoning: 'Failed to parse AI response', suggested_rent: null, urgency: 'low' };
  }
  return JSON.parse(json) as AIDecision;
}
