import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getInvoicesForTenant } from '@/lib/billing/invoices';
import type { RentInvoice } from '@/lib/types';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: RentInvoice['status']) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    succeeded: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-red-100 text-red-800',
    overdue: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status] ?? 'bg-zinc-100 text-zinc-800'}`}>
      {status}
    </span>
  );
}

export default async function RenterPaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/auth/login');

  // Find the landlord_tenants record linked to this auth user
  const svc = createServiceClient();
  const { data: tenantRecord } = await svc
    .from('landlord_tenants')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  // Get payment method info
  const { data: profile } = await svc
    .from('profiles')
    .select('payment_method_type, payment_method_last4')
    .eq('id', user.id)
    .single();

  const invoices = tenantRecord ? await getInvoicesForTenant(tenantRecord.id) : [];

  // Next upcoming payment
  const nextPending = invoices.find((i) => i.status === 'pending');

  const totalPaid = invoices
    .filter((i) => i.status === 'succeeded')
    .reduce((sum, i) => sum + i.amount_cents, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900">
        Payments
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
        Payment history
      </h1>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Next due</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {nextPending ? formatCents(nextPending.amount_cents) : '—'}
          </p>
          {nextPending && (
            <p className="mt-1 text-xs text-zinc-500">Due {nextPending.due_date}</p>
          )}
        </div>
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Total paid</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{formatCents(totalPaid)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Payment method</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {profile?.payment_method_type && profile?.payment_method_last4
              ? `${profile.payment_method_type} ****${profile.payment_method_last4}`
              : 'None on file'}
          </p>
        </div>
      </div>

      {/* Payment history table */}
      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-500">No payment history yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-900/10 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-zinc-600">Due date</th>
                <th className="px-4 py-3 font-semibold text-zinc-600">Amount</th>
                <th className="px-4 py-3 font-semibold text-zinc-600">Status</th>
                <th className="px-4 py-3 font-semibold text-zinc-600">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 text-zinc-900">{inv.due_date}</td>
                  <td className="px-4 py-3 text-zinc-900">{formatCents(inv.amount_cents)}</td>
                  <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                  <td className="px-4 py-3 text-zinc-500">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
