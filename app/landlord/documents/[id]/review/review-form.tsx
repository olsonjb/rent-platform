'use client';

import { useState } from 'react';
import { confirmExtraction, requestReExtraction } from '@/app/actions/lease-documents';
import type { ExtractedLeaseData } from '@/lib/types';

interface ReviewFormProps {
  documentId: string;
  initialData: ExtractedLeaseData;
  fileUrl: string;
}

export function ReviewForm({ documentId, initialData, fileUrl }: ReviewFormProps) {
  const [data, setData] = useState<ExtractedLeaseData>(initialData);
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof ExtractedLeaseData>(key: K, value: ExtractedLeaseData[K]) {
    setData(prev => ({ ...prev, [key]: value }));
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await confirmExtraction(documentId, data);
    } catch {
      setSubmitting(false);
    }
  }

  async function handleReExtract() {
    setSubmitting(true);
    try {
      await requestReExtraction(documentId);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* PDF Viewer */}
      <div className="rounded-2xl border border-zinc-900/10 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700">Original document</h2>
        <iframe
          src={fileUrl}
          className="h-[600px] w-full rounded-lg border border-zinc-200"
          title="Lease PDF"
        />
      </div>

      {/* Extracted Fields */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-zinc-700">Extracted fields</h2>
          <div className="space-y-3">
            <FieldInput
              label="Tenant names (comma-separated)"
              value={data.tenant_names.join(', ')}
              onChange={v => updateField('tenant_names', v.split(',').map(s => s.trim()).filter(Boolean))}
            />
            <FieldInput
              label="Street"
              value={data.address.street ?? ''}
              onChange={v => updateField('address', { ...data.address, street: v || null })}
            />
            <div className="grid grid-cols-3 gap-2">
              <FieldInput
                label="City"
                value={data.address.city ?? ''}
                onChange={v => updateField('address', { ...data.address, city: v || null })}
              />
              <FieldInput
                label="State"
                value={data.address.state ?? ''}
                onChange={v => updateField('address', { ...data.address, state: v || null })}
              />
              <FieldInput
                label="ZIP"
                value={data.address.zip ?? ''}
                onChange={v => updateField('address', { ...data.address, zip: v || null })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FieldInput
                label="Monthly rent ($)"
                value={data.monthly_rent?.toString() ?? ''}
                onChange={v => updateField('monthly_rent', v ? parseFloat(v) : null)}
                type="number"
              />
              <FieldInput
                label="Security deposit ($)"
                value={data.security_deposit?.toString() ?? ''}
                onChange={v => updateField('security_deposit', v ? parseFloat(v) : null)}
                type="number"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FieldInput
                label="Lease start"
                value={data.lease_start_date ?? ''}
                onChange={v => updateField('lease_start_date', v || null)}
                type="date"
              />
              <FieldInput
                label="Lease end"
                value={data.lease_end_date ?? ''}
                onChange={v => updateField('lease_end_date', v || null)}
                type="date"
              />
            </div>
            <FieldInput
              label="Pet policy"
              value={data.pet_policy ?? ''}
              onChange={v => updateField('pet_policy', v || null)}
            />
            <FieldInput
              label="Parking policy"
              value={data.parking_policy ?? ''}
              onChange={v => updateField('parking_policy', v || null)}
            />
            <FieldInput
              label="Quiet hours"
              value={data.quiet_hours ?? ''}
              onChange={v => updateField('quiet_hours', v || null)}
            />
            <FieldInput
              label="Late fee terms"
              value={data.late_fee_terms ?? ''}
              onChange={v => updateField('late_fee_terms', v || null)}
            />
            <FieldInput
              label="Early termination"
              value={data.early_termination_terms ?? ''}
              onChange={v => updateField('early_termination_terms', v || null)}
            />

            <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Contact info
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <FieldInput
                label="Name"
                value={data.contact_info.name ?? ''}
                onChange={v => updateField('contact_info', { ...data.contact_info, name: v || null })}
              />
              <FieldInput
                label="Phone"
                value={data.contact_info.phone ?? ''}
                onChange={v => updateField('contact_info', { ...data.contact_info, phone: v || null })}
              />
              <FieldInput
                label="Email"
                value={data.contact_info.email ?? ''}
                onChange={v => updateField('contact_info', { ...data.contact_info, email: v || null })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Confirm & create'}
          </button>
          <button
            onClick={handleReExtract}
            disabled={submitting}
            className="inline-flex rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Re-extract
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
    </div>
  );
}
