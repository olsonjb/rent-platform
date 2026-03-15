import { createHmac } from 'crypto';
import type { ListingProvider, PropertyListing, SubmitResult } from './types';
import { logProviderSubmission } from './logger';

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

async function postWithRetry(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<Response> {
  const attempt = async () =>
    fetch(url, { method: 'POST', headers, body });

  const first = await attempt();
  if (first.ok) return first;

  // Retry once with 1s backoff
  await new Promise((r) => setTimeout(r, 1000));
  return attempt();
}

export const webhookProvider: ListingProvider = {
  name: 'Webhook',
  async submit(listing: PropertyListing): Promise<SubmitResult> {
    const url = process.env.WEBHOOK_LISTING_URL;
    const secret = process.env.WEBHOOK_LISTING_SECRET;

    if (!url) {
      const error = 'Missing WEBHOOK_LISTING_URL';
      logProviderSubmission({ provider: 'Webhook', status: 'failed', response_data: { error } });
      return { provider: 'Webhook', success: false, error };
    }

    const body = JSON.stringify(listing);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (secret) {
      headers['X-Webhook-Signature'] = signPayload(body, secret);
    }

    try {
      const res = await postWithRetry(url, body, headers);

      if (!res.ok) {
        const error = `Webhook returned ${res.status}`;
        logProviderSubmission({
          provider: 'Webhook',
          status: 'failed',
          response_data: { error, statusCode: res.status },
        });
        return { provider: 'Webhook', success: false, error };
      }

      logProviderSubmission({
        provider: 'Webhook',
        status: 'success',
        response_data: { statusCode: res.status },
      });

      return { provider: 'Webhook', success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Webhook request failed';
      logProviderSubmission({
        provider: 'Webhook',
        status: 'failed',
        response_data: { error },
      });
      return { provider: 'Webhook', success: false, error };
    }
  },
};

// Exported for testing
export { signPayload, postWithRetry };
