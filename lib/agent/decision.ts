import Anthropic from '@anthropic-ai/sdk';
import type { Property, Lease } from '@/lib/types';
import type { AIDecision } from '@/lib/types';

const client = new Anthropic();

export async function makeListingDecision(
  property: Property,
  lease: Lease
): Promise<AIDecision> {
  const daysUntilExpiry = Math.ceil(
    (new Date(lease.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const prompt = `You are a property management AI agent. Analyze whether a rental property should be listed now.

Property:
- Address: ${property.address}, ${property.city}, ${property.state} ${property.zip}
- Bedrooms: ${property.bedrooms}, Bathrooms: ${property.bathrooms}${property.sqft ? `, Sqft: ${property.sqft}` : ''}
- Current rent: $${property.monthly_rent}/month

Lease:
- End date: ${lease.end_date} (${daysUntilExpiry} days from now)
- Monthly rent: $${lease.monthly_rent}
- Renewal offered: ${lease.renewal_offered ? 'Yes' : 'No'}
- Status: ${lease.status}

Decision criteria:
1. Lease expires within 30 days
2. No renewal has been offered or accepted
3. Property should be listed at market-competitive price

Respond with valid JSON only (no markdown, no explanation outside JSON):
{
  "should_list": true,
  "reasoning": "brief explanation",
  "suggested_price": 2500,
  "urgency": "high"
}

urgency scale: "low" (>25 days), "medium" (15-25 days), "high" (<15 days)`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text.trim();
  return JSON.parse(text) as AIDecision;
}
