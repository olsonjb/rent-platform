import { registerPrompt } from './index';
import { getModelConfig } from '../models';

export interface MaintenanceEstimateContext {
  issue: string;
  details: string | null;
  location: string | null;
  urgency: string;
  unit: string;
  propertyName: string;
  propertyAddress: string;
}

export function buildMaintenanceEstimatePrompt(ctx: MaintenanceEstimateContext): string {
  return [
    'Estimate this maintenance request for a US residential property.',
    'Return JSON only with keys:',
    'trade (string)',
    'severity (one of: low, medium, high, critical)',
    'estimated_cost_min (number, USD)',
    'estimated_cost_max (number, USD)',
    'confidence (number 0-1)',
    'summary (string, <= 220 chars, plain language)',
    'Do not include markdown or additional keys.',
    '',
    `Issue title: ${ctx.issue}`,
    `Issue details: ${ctx.details ?? 'Not provided'}`,
    `Location in unit: ${ctx.location ?? 'Not provided'}`,
    `Urgency: ${ctx.urgency}`,
    `Unit: ${ctx.unit}`,
    `Property: ${ctx.propertyName}`,
    `Address: ${ctx.propertyAddress}`,
  ].join('\n');
}

const maintenanceConfig = getModelConfig('maintenance');

registerPrompt({
  name: 'maintenance-estimate',
  version: '1.0.0',
  template: (vars) => buildMaintenanceEstimatePrompt({
    issue: vars.issue,
    details: vars.details || null,
    location: vars.location || null,
    urgency: vars.urgency,
    unit: vars.unit,
    propertyName: vars.propertyName,
    propertyAddress: vars.propertyAddress,
  }),
  model: maintenanceConfig.model,
  maxTokens: maintenanceConfig.maxTokens,
  temperature: maintenanceConfig.temperature,
});
