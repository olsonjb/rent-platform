import { NextRequest, NextResponse } from "next/server";
import { processQueuedApplicationScreenings } from "@/lib/application-screening";

const getWorkerSecrets = (): string[] => {
  const secrets = [
    process.env.APPLICATION_SCREENING_WORKER_SECRET,
    process.env.CRON_SECRET,
  ].filter((secret): secret is string => typeof secret === "string" && secret.length > 0);

  if (secrets.length === 0) {
    throw new Error("Missing APPLICATION_SCREENING_WORKER_SECRET or CRON_SECRET");
  }

  return secrets;
};

const parseBatchSize = (request: NextRequest): number | undefined => {
  const sizeParam = request.nextUrl.searchParams.get("batch");
  if (!sizeParam) return undefined;
  const parsed = Number.parseInt(sizeParam, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const isAuthorized = (request: NextRequest): boolean => {
  const authorization = request.headers.get("authorization");
  const allowed = getWorkerSecrets();
  if (!authorization) return false;
  return allowed.some((secret) => authorization === `Bearer ${secret}`);
};

async function handleProcessRequest(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await processQueuedApplicationScreenings(parseBatchSize(request));
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
