"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, Suspense } from "react";
import {
  MAINTENANCE_REQUEST_ENTRY_PERMISSION_LABELS,
  MAINTENANCE_REQUEST_ENTRY_PERMISSIONS,
  MAINTENANCE_REQUEST_LOCATION_LABELS,
  MAINTENANCE_REQUEST_LOCATIONS,
  MAINTENANCE_REQUEST_URGENCY_LABELS,
  MAINTENANCE_REQUEST_URGENCIES,
} from "@/lib/maintenance-requests";
import { createMaintenanceRequest } from "../actions";

const URGENCY_DESCRIPTIONS: Record<string, string> = {
  habitability:
    "Health or safety issue — no heat, water leak, gas smell, mold, broken lock",
  standard: "Non-emergency — cosmetic damage, appliance issue, minor repair",
};

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE_MB = 10;

export default function NewMaintenanceRequestPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewMaintenanceRequestContent />
    </Suspense>
  );
}

function NewMaintenanceRequestContent() {
  const searchParams = useSearchParams();
  const hasSuccess = searchParams.get("success") === "1";
  const requestId = searchParams.get("requestId");
  const errorMessage = searchParams.get("error");

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (hasSuccess) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-emerald-900">Request submitted</h2>
          {requestId ? (
            <p className="mt-2 text-sm text-emerald-700">
              Request ID: <span className="font-mono font-medium">{requestId.slice(0, 8)}</span>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-emerald-700">
            Your property team will review and follow up within 1-2 business days.
            Habitability issues are prioritized for same-day response.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/renter/maintenance-requests"
              className="inline-flex rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              View my requests
            </Link>
            <Link
              href="/renter/maintenance-requests/new"
              className="inline-flex rounded-full border border-emerald-300 px-5 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              Submit another
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_PHOTOS - photos.length;
    const newFiles = files.slice(0, remaining);

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) continue;
      if (!file.type.startsWith("image/")) continue;
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setPhotos((prev) => [...prev, ...validFiles]);
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (formData: FormData) => {
    setSubmitting(true);
    for (const photo of photos) {
      formData.append("photos", photo);
    }
    await createMaintenanceRequest(formData);
    setSubmitting(false);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/renter/dashboard"
          className="inline-flex rounded-full border border-zinc-900/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:bg-zinc-100"
        >
          Back to dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          Submit a maintenance request
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">
          Share the issue details and we will route the request to the right team.
        </p>
      </div>

      <form
        className="space-y-6 rounded-2xl border border-zinc-900/10 bg-white p-6 shadow-sm"
        action={handleSubmit}
      >
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
                  {MAINTENANCE_REQUEST_LOCATION_LABELS[location]}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-900">Urgency</legend>
            <div className="grid gap-3 text-sm text-zinc-700">
              {MAINTENANCE_REQUEST_URGENCIES.map((urgency) => (
                <label key={urgency} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="urgency"
                    value={urgency}
                    required
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{MAINTENANCE_REQUEST_URGENCY_LABELS[urgency]}</span>
                    <span className="block text-xs text-zinc-500">
                      {URGENCY_DESCRIPTIONS[urgency]}
                    </span>
                  </span>
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

        {/* Photo upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-900">
            Photos <span className="font-normal text-zinc-500">(optional, max {MAX_PHOTOS})</span>
          </label>
          {photoPreviews.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {photoPreviews.map((src, i) => (
                <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {photos.length < MAX_PHOTOS ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-600 transition hover:border-zinc-500 hover:text-zinc-900"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add photos
              </label>
              <p className="mt-1 text-xs text-zinc-500">
                JPEG, PNG, WebP or GIF. Max {MAX_FILE_SIZE_MB}MB each.
              </p>
            </div>
          ) : null}
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
                  {MAINTENANCE_REQUEST_ENTRY_PERMISSION_LABELS[entryPermission]}
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
          disabled={submitting}
          className="inline-flex rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Send request"}
        </button>

        {errorMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="h-10 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="h-[500px] animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  );
}
