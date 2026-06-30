import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  getGenerativeModel: vi.fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = mocks.getGenerativeModel;
  },
  SchemaType: { OBJECT: "object", STRING: "string", ARRAY: "array" },
}));

import { classifyGeminiError, extractWithGemini } from "@/lib/gemini";

const validResult = {
  title: "Frontend Engineer", company: "Example Co", location: null, remoteMode: "Remote",
  employmentType: null, requiredSkills: ["React"], preferredSkills: [], minimumExperience: "3 years",
  education: null, responsibilities: ["Build interfaces"], salary: null,
  applicationDeadline: null, summary: "Build accessible web interfaces.",
};

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
  mocks.generateContent.mockReset();
  mocks.getGenerativeModel.mockReset();
  mocks.getGenerativeModel.mockReturnValue({ generateContent: mocks.generateContent });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  delete process.env.EXTERNAL_REQUEST_PROMPT_DEBUG;
});

describe("Gemini extraction", () => {
  it("uses Gemini 2.5 Flash-Lite by default and accepts valid structured output", async () => {
    mocks.generateContent.mockResolvedValue({ response: { text: () => JSON.stringify(validResult) } });
    await expect(extractWithGemini("React role")).resolves.toEqual(validResult);
    expect(mocks.getGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-2.5-flash-lite" }));
  });

  it("honors a server-side model override", async () => {
    process.env.GEMINI_MODEL = "gemini-custom";
    mocks.generateContent.mockResolvedValue({ response: { text: () => JSON.stringify(validResult) } });
    await extractWithGemini("React role");
    expect(mocks.getGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-custom" }));
  });

  it("logs the exact extraction prompt when prompt debug is enabled", async () => {
    process.env.EXTERNAL_REQUEST_PROMPT_DEBUG = "true";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.generateContent.mockResolvedValue({ response: { text: () => JSON.stringify(validResult) } });

    await expect(extractWithGemini("React role")).resolves.toEqual(validResult);

    expect(info).toHaveBeenCalledWith(
      "External request prompt: Gemini job extraction",
      expect.objectContaining({
        provider: "Gemini",
        action: "job extraction",
        model: "gemini-2.5-flash-lite",
        prompt: expect.stringContaining("UNTRUSTED JOB CONTENT START\nReact role\nUNTRUSTED JOB CONTENT END"),
      }),
    );
  });

  it("rejects malformed JSON and model-added fields", async () => {
    mocks.generateContent.mockResolvedValueOnce({ response: { text: () => "not-json" } });
    await expect(extractWithGemini("React role")).rejects.toMatchObject({ code: "MALFORMED_JSON" });
    mocks.generateContent.mockResolvedValueOnce({ response: { text: () => JSON.stringify({ ...validResult, inventedScore: 99 }) } });
    await expect(extractWithGemini("React role")).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("times out a stalled Gemini request", async () => {
    vi.useFakeTimers();
    mocks.generateContent.mockReturnValue(new Promise(() => undefined));
    const extraction = extractWithGemini("React role");
    const rejection = expect(extraction).rejects.toMatchObject({ code: "MODEL_TIMEOUT", status: 504 });
    await vi.advanceTimersByTimeAsync(20_000);
    await rejection;
  });
});

describe("Gemini error classification", () => {
  it("returns retry metadata only for a temporary rate limit", () => {
    const error = Object.assign(new Error("Resource exhausted"), {
      status: 429,
      errorDetails: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "7.2s" }],
    });
    expect(classifyGeminiError(error)).toMatchObject({ code: "RATE_LIMITED", status: 429, retryAfterSeconds: 8 });
  });

  it("treats zero or unavailable quota as a project configuration issue", () => {
    const error = Object.assign(new Error("Quota exceeded"), {
      status: 429,
      errorDetails: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaValue: "0" }] }],
    });
    expect(classifyGeminiError(error)).toMatchObject({ code: "QUOTA_UNAVAILABLE", status: 503, retryAfterSeconds: undefined });
  });

  it("identifies invalid or restricted API keys", () => {
    const error = Object.assign(new Error("API key not valid"), { status: 400 });
    expect(classifyGeminiError(error)).toMatchObject({ code: "INVALID_API_KEY", status: 503 });
  });

  it("reports temporary model capacity separately from quota", () => {
    const error = Object.assign(new Error("This model is currently experiencing high demand."), { status: 503 });
    expect(classifyGeminiError(error)).toMatchObject({ code: "MODEL_BUSY", status: 503, retryAfterSeconds: undefined });
  });
});
