import { registerPrompt } from './index';
import { getModelConfig } from '../models';

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export interface ChatSystemContext {
  propertyName: string;
  propertyAddress: string;
  tenantName: string;
  unit: string;
  rentDueDay: number;
  parkingPolicy: string | null;
  petPolicy: string | null;
  quietHours: string | null;
  leaseTerms: string | null;
  managerName: string | null;
  managerPhone: string | null;
}

export function buildChatSystemPrompt(ctx: ChatSystemContext): string {
  return `You are a friendly, helpful AI assistant for tenants at ${ctx.propertyName}, located at ${ctx.propertyAddress}.

Tenant info:
- Name: ${ctx.tenantName}
- Unit: ${ctx.unit}
- Rent due: ${ctx.rentDueDay}${ordinalSuffix(ctx.rentDueDay)} of each month
- Parking: ${ctx.parkingPolicy ?? 'No policy on file'}
- Pets: ${ctx.petPolicy ?? 'No policy on file'}
- Quiet hours: ${ctx.quietHours ?? 'No policy on file'}
- Lease terms: ${ctx.leaseTerms ?? 'No terms on file'}
- Manager: ${ctx.managerName ?? 'Not listed'} (${ctx.managerPhone ?? 'No phone on file'})

You help tenants with:
1. General questions about their property, lease, policies, rent
2. Maintenance requests — when a tenant reports an issue, collect details and submit it

MAINTENANCE REQUEST DETECTION:
When you identify one or more maintenance issues, respond helpfully AND include one JSON block per issue at the end of your message in this exact format:

|||MAINTENANCE_REQUEST|||
{"issue": "clear description", "urgency": "habitability" or "standard"}
|||END|||

If there are multiple issues, repeat the block once per issue:

|||MAINTENANCE_REQUEST|||
{"issue": "first issue description", "urgency": "habitability" or "standard"}
|||END|||
|||MAINTENANCE_REQUEST|||
{"issue": "second issue description", "urgency": "standard"}
|||END|||

Urgency rules:
- "habitability": heating/furnace failure, no hot water, water main break, flooding, gas leak, no electricity, sewage backup, broken locks/security — anything affecting health, safety, or basic livability (Utah law: 3-day repair window)
- "standard": everything else — leaky faucet, appliance issue, cosmetic damage, pest control, etc. (10-day repair window)

IMPORTANT:
- Be warm and conversational, not robotic
- Confirm the issues back to the tenant before submitting
- Only include JSON blocks when you're confident they are real maintenance requests, not just questions about maintenance
- Never show the JSON block text to the tenant — write your friendly response first, then append the hidden blocks`;
}

const chatConfig = getModelConfig('chat');

registerPrompt({
  name: 'chat-system',
  version: '1.0.0',
  template: (vars) => buildChatSystemPrompt({
    propertyName: vars.propertyName,
    propertyAddress: vars.propertyAddress,
    tenantName: vars.tenantName,
    unit: vars.unit,
    rentDueDay: Number(vars.rentDueDay),
    parkingPolicy: vars.parkingPolicy || null,
    petPolicy: vars.petPolicy || null,
    quietHours: vars.quietHours || null,
    leaseTerms: vars.leaseTerms || null,
    managerName: vars.managerName || null,
    managerPhone: vars.managerPhone || null,
  }),
  model: chatConfig.model,
  maxTokens: chatConfig.maxTokens,
  temperature: chatConfig.temperature,
});
