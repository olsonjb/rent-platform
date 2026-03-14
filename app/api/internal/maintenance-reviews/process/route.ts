import { NextRequest, NextResponse } from "next/server";
import { processQueuedMaintenanceReviews } from "@/lib/maintenance-review";

const getWorkerSecret = (): string => {
  const secret = process.env.MAINTENANCE_REVIEW_WORKER_SECRET;

  if (!secret) {
    throw new Error("Missing MAINTENANCE_REVIEW_WORKER_SECRET");
  }

  return secret;
};

const parseBatchSize = (request: NextRequest): number | undefined => {
  const sizeParam = request.nextUrl.searchParams.get("batch");

  if (!sizeParam) {
    return undefined;
  }

  const parsed = Number.parseInt(sizeParam, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const isAuthorized = (request: NextRequest): boolean => {
  const authorization = request.headers.get("authorization");
  const expected = `Bearer ${getWorkerSecret()}`;
  return authorization === expected;
};

async function handleProcessRequest(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processQueuedMaintenanceReviews(parseBatchSize(request));
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleProcessRequest(request);
}

export async function GET(request: NextRequest) {
  return handleProcessRequest(request);
}
