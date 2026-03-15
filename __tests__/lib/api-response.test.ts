import { describe, it, expect } from "vitest";
import { apiSuccess, apiError } from "@/lib/api-response";

describe("apiSuccess", () => {
  it("returns JSON with { data } shape", async () => {
    const response = apiSuccess({ items: [1, 2, 3] });
    const body = await response.json();
    expect(body).toEqual({ data: { items: [1, 2, 3] } });
    expect(response.status).toBe(200);
  });

  it("supports custom status code", async () => {
    const response = apiSuccess("created", undefined, 201);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ data: "created" });
  });

  it("sets correlation ID header when provided", () => {
    const response = apiSuccess({}, "corr-123");
    expect(response.headers.get("x-correlation-id")).toBe("corr-123");
  });

  it("does not set correlation ID header when not provided", () => {
    const response = apiSuccess({});
    expect(response.headers.get("x-correlation-id")).toBeNull();
  });

  it("works with null data", async () => {
    const response = apiSuccess(null);
    const body = await response.json();
    expect(body).toEqual({ data: null });
  });
});

describe("apiError", () => {
  it("returns JSON with { error: { message } } shape", async () => {
    const response = apiError("Something went wrong", 500);
    const body = await response.json();
    expect(body).toEqual({
      error: { message: "Something went wrong" },
    });
    expect(response.status).toBe(500);
  });

  it("defaults to 500 status", async () => {
    const response = apiError("fail");
    expect(response.status).toBe(500);
  });

  it("includes error code when provided", async () => {
    const response = apiError("Not found", 404, undefined, "NOT_FOUND");
    const body = await response.json();
    expect(body).toEqual({
      error: { message: "Not found", code: "NOT_FOUND" },
    });
  });

  it("sets correlation ID header when provided", () => {
    const response = apiError("fail", 500, "corr-456");
    expect(response.headers.get("x-correlation-id")).toBe("corr-456");
  });

  it("returns 401 for unauthorized", async () => {
    const response = apiError("Unauthorized", 401, undefined, "UNAUTHORIZED");
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for bad request", async () => {
    const response = apiError("Bad request", 400);
    expect(response.status).toBe(400);
  });
});
