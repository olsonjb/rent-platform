import Link from "next/link";
import { Suspense } from "react";
import {
  MAINTENANCE_REQUEST_ENTRY_PERMISSIONS,
  MAINTENANCE_REQUEST_LOCATIONS,
  MAINTENANCE_REQUEST_URGENCIES,
} from "@/lib/maintenance-requests";
import { createMaintenanceRequest } from "../actions";

const LOCATION_LABELS: Record<(typeof MAINTENANCE_REQUEST_LOCATIONS)[number], string> = {
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  "living-room": "Living room",
  bedroom: "Bedroom",
  hvac: "Heating / cooling",
  other: "Other",
};

const URGENCY_LABELS: Record<(typeof MAINTENANCE_REQUEST_URGENCIES)[number], string> = {
  habitability: "Habitability (health/safety concern)",
  standard: "Standard (non-emergency)",
};

const ENTRY_PERMISSION_LABELS: Record<
  (typeof MAINTENANCE_REQUEST_ENTRY_PERMISSIONS)[number],
  string
> = {
  "can-enter": "Can enter with notice",
  "present-only": "Only when I am present",
};

type NewMaintenanceRequestPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function NewMaintenanceRequestPage({
  searchParams,
}: NewMaintenanceRequestPageProps) {
  return (
    <Suspense>
      <NewMaintenanceRequestContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewMaintenanceRequestContent({
  searchParams,
}: NewMaintenanceRequestPageProps) {
  const resolvedSearchParams = await searchParams;

  const hasSuccessState = resolvedSearchParams.success === "1";
  const errorMessage = resolvedSearchParams.error;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/renter/dashboard"
          className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:bg-zinc-100"
        >
          Back to renter dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Submit a maintenance request
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
          Share the issue details and we will route the request to the right team.
        </p>
        <Link
          href="/renter/maintenance-requests"
          className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:bg-zinc-100"
        >
          View my requests
        </Link>
      </div>

      <form className="space-y-6 rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm" action={createMaintenanceRequest}>
        <div className="space-y-2">
          <label htmlFor="issue-title" className="text-sm font-medium text-zinc-900">
            Issue title
          </label>
          <input
            id="issue-title"
            name="issueTitle"
            type="text"
            required
            placeholder="Example: Kitchen sink leaking"
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="unit" className="text-sm font-medium text-zinc-900">
            Unit number
          </label>
          <input
            id="unit"
            name="unit"
            type="text"
            required
            placeholder="Example: 2B"
            className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium text-zinc-900">
              Location in unit
            </label>
            <select
              id="location"
              name="location"
              required
              defaultValue=""
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            >
              <option value="" disabled>
                Select a location
              </option>
              {MAINTENANCE_REQUEST_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {LOCATION_LABELS[location]}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-900">Urgency</legend>
            <div className="grid gap-2 text-sm text-zinc-700">
              {MAINTENANCE_REQUEST_URGENCIES.map((urgency) => (
                <label key={urgency} className="flex items-center gap-2">
                  <input type="radio" name="urgency" value={urgency} required />
                  {URGENCY_LABELS[urgency]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="space-y-2">
          <label htmlFor="details" className="text-sm font-medium text-zinc-900">
            Describe the issue
          </label>
          <textarea
            id="details"
            name="details"
            required
            rows={5}
            placeholder="When did this start? What have you noticed?"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="entry" className="text-sm font-medium text-zinc-900">
              Entry permission
            </label>
            <select
              id="entry"
              name="entryPermission"
              required
              defaultValue=""
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            >
              <option value="" disabled>
                Select an option
              </option>
              {MAINTENANCE_REQUEST_ENTRY_PERMISSIONS.map((entryPermission) => (
                <option key={entryPermission} value={entryPermission}>
                  {ENTRY_PERMISSION_LABELS[entryPermission]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-zinc-900">
              Best contact number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              placeholder="(555) 123-4567"
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
            />
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Send request
        </button>

        {hasSuccessState ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Request submitted. Your property team will review and follow up shortly.
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </div>
  );
}
