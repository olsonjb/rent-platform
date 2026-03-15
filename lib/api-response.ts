import { NextResponse } from "next/server";
import { setCorrelationIdHeader } from "@/lib/correlation";

/**
 * Standard API success response.
 *
 * Shape: { data: T }
 */
export function apiSuccess<T>(
  data: T,
  correlationId?: string,
  status: number = 200
): NextResponse {
  const response = NextResponse.json({ data }, { status });
  if (correlationId) {
    return setCorrelationIdHeader(response, correlationId);
  }
  return response;
}

/**
 * Standard API error response.
 *
 * Shape: { error: { message: string; code?: string } }
 */
export function apiError(
  message: string,
  status: number = 500,
  correlationId?: string,
  code?: string
): NextResponse {
  const body: { error: { message: string; code?: string } } = {
    error: { message },
  };
  if (code) {
    body.error.code = code;
  }
  const response = NextResponse.json(body, { status });
  if (correlationId) {
    return setCorrelationIdHeader(response, correlationId);
  }
  return response;
}
