import Anthropic from '@anthropic-ai/sdk';
import type { Property, Lease, AIDecision, AIContent } from '@/lib/types';

const client = new Anthropic();

export async function generateListingContent(
  property: Property,
  lease: Lease,
  decision: AIDecision
): Promise<AIContent> {
  const availableDate = new Date(lease.end_date);
  availableDate.setDate(availableDate.getDate() + 1);

  const prompt = `You are a real estate copywriting AI. Generate compelling rental listing content.

Property:
- Address: ${property.address}, ${property.city}, ${property.state} ${property.zip}
- Bedrooms: ${property.bedrooms}, Bathrooms: ${property.bathrooms}${property.sqft ? `, ${property.sqft} sqft` : ''}
- Asking price: $${decision.suggested_price}/month
- Available: ${availableDate.toISOString().split('T')[0]}

Write an attractive, accurate listing. Respond with valid JSON only (no markdown):
{
  "title": "Spacious 2BR/1BA in Downtown Austin - Available April 1",
  "description": "2-3 paragraph description highlighting key features, neighborhood, and value",
  "asking_price": ${decision.suggested_price},
  "available_date": "${availableDate.toISOString().split('T')[0]}",
  "highlights": ["highlight 1", "highlight 2", "highlight 3", "highlight 4"]
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text.trim();
  return JSON.parse(text) as AIContent;
}
