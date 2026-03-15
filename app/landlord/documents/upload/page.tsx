import { uploadLeaseDocument } from '@/app/actions/lease-documents';
import Link from 'next/link';

export default function UploadLeaseDocumentPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="/landlord/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          &larr; Back to dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
        Upload lease document
      </h1>
      <p className="text-sm text-zinc-600">
        Upload a lease PDF and our AI will extract key terms like tenant names,
        rent amount, dates, and policies. You will review and confirm before any
        records are created.
      </p>

      <form action={uploadLeaseDocument} className="space-y-4">
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm">
          <label
            htmlFor="file"
            className="block text-sm font-medium text-zinc-700"
          >
            Lease PDF
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="application/pdf"
            required
            className="mt-2 block w-full text-sm text-zinc-600 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-200"
          />
          <p className="mt-2 text-xs text-zinc-500">PDF only, max 20MB</p>
        </div>

        <button
          type="submit"
          className="inline-flex rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Upload &amp; extract
        </button>
      </form>
    </div>
  );
}
