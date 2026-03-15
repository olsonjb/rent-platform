import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const CORRELATION_HEADER = "x-correlation-id";

/** Generate a new correlation ID. */
export function generateCorrelationId(): string {
  return randomUUID();
}

/** Read the correlation ID from the request header, or generate a new one. */
export function getCorrelationId(request: NextRequest): string {
  return request.headers.get(CORRELATION_HEADER) ?? generateCorrelationId();
}

/** Set the correlation ID header on a response. */
export function setCorrelationIdHeader(
  response: NextResponse,
  correlationId: string,
): NextResponse {
  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}
