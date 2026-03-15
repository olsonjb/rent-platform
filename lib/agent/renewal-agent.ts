import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { withAITracking } from '@/lib/ai-metrics';
import { getModelConfig } from '@/lib/ai/models';
import { extractJson } from '@/lib/ai/extractors';
import type { RenewalEvaluation } from '@/lib/types';

const logger = createLogger('renewal-agent');
const client = new Anthropic();

const FALLBACK_EVALUATION: RenewalEvaluation = {
  recommendation: 'renew-same',
  suggested_rent: 0,
  reasoning: 'Failed to parse AI response — defaulting to renew at same terms',
  tenant_score: 5,
  factors: {
    payment_history: 'Unknown',
    maintenance_requests: 'Unknown',
    tenure_length: 'Unknown',
    communication: 'Unknown',
  },
};

interface LeaseForEvaluation {
  id: string;
  landlord_id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  properties: {
    address: string;
    city: string | null;
    state: string | null;
  };
  landlord_tenants: {
    name: string;
    email: string;
  };
}

export async function evaluateTenantForRenewal(leaseId: string): Promise<RenewalEvaluation> {
  const supabase = createServiceClient();

  // Fetch lease with relations
  const { data: lease, error: leaseError } = await supabase
    .from('leases')
    .select('id, landlord_id, property_id, tenant_id, start_date, end_date, monthly_rent, properties(address, city, state), landlord_tenants(name, email)')
    .eq('id', leaseId)
    .single();

  if (leaseError || !lease) {
    logger.error({ leaseId, err: leaseError }, 'Failed to fetch lease for renewal evaluation');
    throw new Error(`Lease not found: ${leaseId}`);
  }

  const typedLease = lease as unknown as LeaseForEvaluation;

  // Gather tenant signals (best-effort — tables may not exist)
  const tenureMonths = Math.round(
    (new Date(typedLease.end_date).getTime() - new Date(typedLease.start_date).getTime()) /
      (1000 * 60 * 60 * 24 * 30),
  );

  // Query maintenance requests for this tenant's property (best-effort)
  let maintenanceCount = 0;
  let habitabilityCount = 0;
  try {
    const { data: maintenanceData } = await supabase
      .from('maintenance_requests')
      .select('id, urgency')
      .eq('unit', typedLease.properties.address);

    if (maintenanceData) {
      maintenanceCount = maintenanceData.length;
      habitabilityCount = maintenanceData.filter(
        (r: { urgency: string }) => r.urgency === 'habitability',
      ).length;
    }
  } catch {
    logger.warn({ leaseId }, 'Could not query maintenance requests');
  }

  const prompt = buildRenewalEvaluationPrompt({
    tenantName: typedLease.landlord_tenants.name,
    propertyAddress: typedLease.properties.address,
    city: typedLease.properties.city,
    state: typedLease.properties.state,
    currentRent: typedLease.monthly_rent,
    leaseStart: typedLease.start_date,
    leaseEnd: typedLease.end_date,
    tenureMonths,
    maintenanceCount,
    habitabilityCount,
  });

  const modelConfig = getModelConfig('renewal');

  const response = await withAITracking(
    { service: 'renewal-agent', endpoint: 'tenant-evaluation' },
    () =>
      client.messages.create({
        model: modelConfig.model,
        max_tokens: modelConfig.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
  );

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const evaluation = extractJson<RenewalEvaluation>(text, {
    ...FALLBACK_EVALUATION,
    suggested_rent: typedLease.monthly_rent,
  });

  return evaluation;
}

interface EvaluationPromptInput {
  tenantName: string;
  propertyAddress: string;
  city: string | null;
  state: string | null;
  currentRent: number;
  leaseStart: string;
  leaseEnd: string;
  tenureMonths: number;
  maintenanceCount: number;
  habitabilityCount: number;
}

function buildRenewalEvaluationPrompt(input: EvaluationPromptInput): string {
  return `You are a property management AI evaluating a tenant for lease renewal.

TENANT: ${input.tenantName}
PROPERTY: ${input.propertyAddress}, ${input.city ?? 'N/A'}, ${input.state ?? 'N/A'}
CURRENT RENT: $${input.currentRent}/month
LEASE PERIOD: ${input.leaseStart} to ${input.leaseEnd} (${input.tenureMonths} months)
MAINTENANCE REQUESTS: ${input.maintenanceCount} total, ${input.habitabilityCount} habitability issues

Evaluate this tenant for renewal considering:
1. Tenure length (longer = more stable, positive signal)
2. Maintenance request frequency (many habitability issues = potential negative signal, but tenants deserve habitable housing)
3. Current market conditions (assume modest 2-4% annual rent increases are normal)

Respond with ONLY a JSON object:
{
  "recommendation": "renew-adjust" | "renew-same" | "do-not-renew",
  "suggested_rent": <number - suggested monthly rent for new lease>,
  "reasoning": "<2-3 sentence explanation>",
  "tenant_score": <1-10 overall tenant quality score>,
  "factors": {
    "payment_history": "<brief assessment or 'No data available'>",
    "maintenance_requests": "<brief assessment>",
    "tenure_length": "<brief assessment>",
    "communication": "<brief assessment or 'No data available'>"
  }
}`;
}
