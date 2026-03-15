"use client";

import { useState } from "react";
import { generateListingForProperty } from "@/app/actions/listings";

export function GenerateListingButton({ propertyId }: { propertyId: string }) {
  const [state, setState] = useState<{ loading: boolean; message: string | null; error: boolean }>({
    loading: false,
    message: null,
    error: false,
  });

  async function handleClick() {
    setState({ loading: true, message: null, error: false });
    try {
      const result = await generateListingForProperty(propertyId);
      setState({ loading: false, message: result.message, error: !result.success });
    } catch (err) {
      setState({ loading: false, message: "Failed to generate listing", error: true });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={state.loading}
        className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Generating listing…
          </>
        ) : (
          "Generate AI Listing"
        )}
      </button>
      {state.message && (
        <p className={`text-sm ${state.error ? "text-rose-600" : "text-emerald-600"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
