import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({ extractJobRequirements: vi.fn() }));
vi.mock("@/lib/extractor", () => ({ extractJobRequirements: mocks.extractJobRequirements }));

import { POST } from "@/app/api/extract/route";

beforeEach(() => { mocks.extractJobRequirements.mockReset(); });

describe("POST /api/extract", () => {
  it("rejects malformed requests", async () => {
    const response = await POST(new Request("http://test/api/extract", { method: "POST", body: JSON.stringify({ inputType: "text", content: "" }) }));
    expect(response.status).toBe(400);
  });

  it("reports a missing server API key without exposing secrets", async () => {
    mocks.extractJobRequirements.mockRejectedValue(new AppError("Gemini is not configured. Add GEMINI_API_KEY to the server environment.", 503, "MISSING_API_KEY"));
    const response = await POST(new Request("http://test/api/extract", { method: "POST", body: JSON.stringify({ inputType: "text", content: "Frontend engineer role requiring React and TypeScript." }) }));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Gemini is not configured. Add GEMINI_API_KEY to the server environment.", code: "MISSING_API_KEY" });
    expect(JSON.stringify(body)).not.toContain("GEMINI_API_KEY=");
  });

  it("returns temporary rate-limit metadata and a Retry-After header", async () => {
    mocks.extractJobRequirements.mockRejectedValue(new AppError("Gemini is temporarily rate-limited. Try again in about 8 seconds.", 429, "RATE_LIMITED", 8));
    const response = await POST(new Request("http://test/api/extract", { method: "POST", body: JSON.stringify({ inputType: "text", content: "Frontend engineer role requiring React." }) }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("8");
    await expect(response.json()).resolves.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 8 });
  });

  it("does not attach retry guidance to unavailable free quota", async () => {
    mocks.extractJobRequirements.mockRejectedValue(new AppError("No Gemini free-tier quota is available for this API project.", 503, "QUOTA_UNAVAILABLE"));
    const response = await POST(new Request("http://test/api/extract", { method: "POST", body: JSON.stringify({ inputType: "text", content: "Frontend engineer role requiring React." }) }));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBeNull();
    await expect(response.json()).resolves.toEqual({ error: "No Gemini free-tier quota is available for this API project.", code: "QUOTA_UNAVAILABLE" });
  });
});
