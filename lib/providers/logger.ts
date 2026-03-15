import { createServiceClient } from '@/lib/supabase/service';

interface ProviderLogEntry {
  listing_id?: string;
  provider: string;
  status: 'success' | 'failed' | 'pending';
  response_data?: Record<string, unknown>;
}

/** Fire-and-forget provider submission logging. Never throws. */
export function logProviderSubmission(entry: ProviderLogEntry): void {
  const db = createServiceClient();
  Promise.resolve(
    db.from('listing_provider_log').insert({
      listing_id: entry.listing_id ?? null,
      provider: entry.provider,
      status: entry.status,
      response_data: entry.response_data ?? {},
    }),
  )
    .then(({ error }) => {
      if (error) {
        console.error('[listing-provider-log] insert failed:', error.message);
      }
    })
    .catch((err: unknown) => {
      console.error('[listing-provider-log] unexpected error:', err);
    });
}
