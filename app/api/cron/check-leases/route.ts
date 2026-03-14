import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runListingAgent } from '@/lib/agent/listing-agent';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Validate cron secret
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Find active leases expiring within 30 days where renewal not offered
  // and no non-failed/expired listing already exists
  const { data: leases, error } = await supabase
    .from('leases')
    .select('id, property_id, landlord_id')
    .eq('status', 'active')
    .eq('renewal_offered', false)
    .gte('end_date', now.toISOString().split('T')[0])
    .lte('end_date', in30Days.toISOString().split('T')[0]);

  if (error) {
    console.error('[cron] failed to query leases', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!leases || leases.length === 0) {
    return NextResponse.json({ scheduled: 0 });
  }

  // Filter out leases that already have a non-failed/expired listing
  const { data: existingListings } = await supabase
    .from('listings')
    .select('lease_id, status')
    .in('lease_id', leases.map((l) => l.id))
    .not('status', 'in', '("failed","expired")');

  const alreadyListedLeaseIds = new Set((existingListings ?? []).map((l) => l.lease_id));
  const toProcess = leases.filter((l) => !alreadyListedLeaseIds.has(l.id));

  if (toProcess.length === 0) {
    return NextResponse.json({ scheduled: 0 });
  }

  // Insert pending listing rows
  const { data: inserted, error: insertError } = await supabase
    .from('listings')
    .insert(
      toProcess.map((l) => ({
        property_id: l.property_id,
        lease_id: l.id,
        landlord_id: l.landlord_id,
        status: 'pending',
      }))
    )
    .select('id');

  if (insertError || !inserted) {
    console.error('[cron] failed to insert listings', insertError);
    return NextResponse.json({ error: insertError?.message ?? 'insert failed' }, { status: 500 });
  }

  // Schedule agent runs after response
  after(async () => {
    await Promise.allSettled(inserted.map((row) => runListingAgent(row.id)));
  });

  return NextResponse.json({ scheduled: inserted.length });
}
