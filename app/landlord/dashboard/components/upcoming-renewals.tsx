'use client';

import { useEffect, useState, useTransition } from 'react';
import { getPendingRenewals, approveRenewal, declineRenewal } from '@/app/actions/renewal-actions';
import type { RenewalOfferWithRelations } from '@/lib/types';

export default function UpcomingRenewals() {
  const [renewals, setRenewals] = useState<RenewalOfferWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [modifiedRents, setModifiedRents] = useState<Record<string, string>>({});

  useEffect(() => {
    getPendingRenewals()
      .then(setRenewals)
      .catch(() => setRenewals([]))
      .finally(() => setLoading(false));
  }, []);

  function handleApprove(offerId: string) {
    const modifiedRent = modifiedRents[offerId];
    startTransition(async () => {
      await approveRenewal(
        offerId,
        modifiedRent ? parseFloat(modifiedRent) : undefined,
      );
      setRenewals((prev) => prev.filter((r) => r.id !== offerId));
    });
  }

  function handleDecline(offerId: string) {
    startTransition(async () => {
      await declineRenewal(offerId);
      setRenewals((prev) => prev.filter((r) => r.id !== offerId));
    });
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Upcoming Renewals</h2>
        <p className="mt-2 text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (renewals.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Upcoming Renewals</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          No upcoming lease renewals to review.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Upcoming Renewals</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        AI-evaluated lease renewals awaiting your decision.
      </p>
      <div className="mt-4 space-y-4">
        {renewals.map((renewal) => (
          <div
            key={renewal.id}
            className="rounded-xl border border-zinc-200 p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-zinc-900">
                  {renewal.landlord_tenants.name}
                </p>
                <p className="text-sm text-zinc-500">
                  {renewal.leases.properties.address}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  renewal.ai_recommendation === 'renew-same'
                    ? 'bg-emerald-100 text-emerald-800'
                    : renewal.ai_recommendation === 'renew-adjust'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {renewal.ai_recommendation === 'renew-same'
                  ? 'Renew (same)'
                  : renewal.ai_recommendation === 'renew-adjust'
                    ? 'Renew (adjust)'
                    : 'Do not renew'}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-500">Current Rent</span>
                <p className="font-medium">${renewal.leases.monthly_rent}/mo</p>
              </div>
              <div>
                <span className="text-zinc-500">Suggested Rent</span>
                <p className="font-medium">${renewal.new_monthly_rent}/mo</p>
                {renewal.suggested_rent_adjustment !== null && renewal.suggested_rent_adjustment !== 0 && (
                  <span
                    className={`text-xs ${
                      renewal.suggested_rent_adjustment > 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {renewal.suggested_rent_adjustment > 0 ? '+' : ''}${renewal.suggested_rent_adjustment}
                  </span>
                )}
              </div>
              <div className="col-span-2">
                <span className="text-zinc-500">Lease Expires</span>
                <p className="font-medium">{renewal.leases.end_date}</p>
              </div>
            </div>

            {renewal.ai_reasoning && (
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                {renewal.ai_reasoning}
              </p>
            )}

            <div className="mt-3">
              <label className="text-xs text-zinc-500">
                Modify rent (optional)
              </label>
              <input
                type="number"
                placeholder={String(renewal.new_monthly_rent)}
                value={modifiedRents[renewal.id] ?? ''}
                onChange={(e) =>
                  setModifiedRents((prev) => ({ ...prev, [renewal.id]: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
              />
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleApprove(renewal.id)}
                disabled={isPending}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve & Send
              </button>
              <button
                onClick={() => handleDecline(renewal.id)}
                disabled={isPending}
                className="rounded-full bg-zinc-200 px-4 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-300 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
