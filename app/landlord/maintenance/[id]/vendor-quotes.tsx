"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveQuote, requestMoreQuotes } from "@/app/actions/vendor-actions";

type VendorOutreachRow = {
  id: string;
  vendor_name: string;
  vendor_phone: string | null;
  outreach_method: string;
  status: string;
  quote_amount_cents: number | null;
  quote_details: string | null;
  vendor_availability: string | null;
  sent_at: string;
  responded_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  sent: "Awaiting reply",
  responded: "Quote received",
  no_response: "No response",
  declined: "Declined",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-amber-100 text-amber-800",
  responded: "bg-emerald-100 text-emerald-800",
  no_response: "bg-zinc-100 text-zinc-600",
  declined: "bg-rose-100 text-rose-800",
};

export function VendorQuotesSection({
  outreach,
  maintenanceRequestId,
  formatCents,
  formatDateTime,
}: {
  outreach: VendorOutreachRow[];
  maintenanceRequestId: string;
  formatCents: (cents: number) => string;
  formatDateTime: (value: string) => string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleApprove = (outreachId: string) => {
    startTransition(async () => {
      const result = await approveQuote(outreachId);
      if (result && "error" in result) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleRequestMore = () => {
    startTransition(async () => {
      const result = await requestMoreQuotes(maintenanceRequestId);
      if (result && "error" in result) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
          Vendor Quotes
        </h2>
        <button
          onClick={handleRequestMore}
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {isPending ? "Requesting..." : "Request More Quotes"}
        </button>
      </div>

      {outreach.length === 0 ? (
        <p className="rounded-xl border border-zinc-900/10 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          No vendors have been contacted yet. Quotes will appear after the AI review completes.
        </p>
      ) : (
        <div className="space-y-3">
          {outreach.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-zinc-950">
                    {row.vendor_name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {row.vendor_phone ?? "No phone"} &middot;{" "}
                    {row.outreach_method.toUpperCase()}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Contacted {formatDateTime(row.sent_at)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[row.status] ?? "bg-zinc-100 text-zinc-600"}`}
                >
                  {STATUS_LABELS[row.status] ?? row.status}
                </span>
              </div>

              {row.status === "responded" && (
                <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                  {row.quote_amount_cents != null && (
                    <p className="text-lg font-semibold text-emerald-700">
                      {formatCents(row.quote_amount_cents)}
                    </p>
                  )}
                  {row.vendor_availability && (
                    <p className="text-sm text-zinc-700">
                      <span className="font-medium">Availability:</span>{" "}
                      {row.vendor_availability}
                    </p>
                  )}
                  {row.quote_details && (
                    <p className="text-sm text-zinc-600">{row.quote_details}</p>
                  )}
                  {row.responded_at && (
                    <p className="text-xs text-zinc-500">
                      Responded {formatDateTime(row.responded_at)}
                    </p>
                  )}
                  <button
                    onClick={() => handleApprove(row.id)}
                    disabled={isPending}
                    className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isPending ? "Approving..." : "Approve Quote"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
