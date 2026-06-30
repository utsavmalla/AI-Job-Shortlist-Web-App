import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
  logExternalRequestEnd,
  logExternalRequestFailure,
  logExternalRequestPrompt,
  logExternalRequestStart,
} from "@/lib/external-request-logger";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.EXTERNAL_REQUEST_DEBUG;
  delete process.env.EXTERNAL_REQUEST_PROMPT_DEBUG;
});

describe("external request logger", () => {
  it("emits simple privacy-safe logs by default", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logExternalRequestStart({
      provider: "Ollama",
      action: "job extraction",
      method: "POST",
      url: "https://ollama.com/api/generate?key=secret",
      model: "gpt-oss:20b",
    });

    expect(info).toHaveBeenCalledWith("External request started: Ollama job extraction POST https://ollama.com/api/generate");
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(info.mock.calls)).not.toContain("gpt-oss:20b");
  });

  it("emits sanitized debug metadata when enabled", () => {
    process.env.EXTERNAL_REQUEST_DEBUG = "true";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logExternalRequestEnd({
      provider: "Job URL",
      action: "page fetch",
      method: "GET",
      url: "https://example.com/jobs/engineer?key=secret&token=private",
      status: 200,
      durationMs: 42,
      redirectCount: 1,
      timeoutMs: 8_000,
      contentType: "text/html",
      contentLength: "1234",
    });

    expect(info).toHaveBeenCalledWith(
      "External request completed: Job URL page fetch GET https://example.com/jobs/engineer",
      {
        provider: "Job URL",
        action: "page fetch",
        method: "GET",
        url: "https://example.com/jobs/engineer",
        model: null,
        status: 200,
        durationMs: 42,
        redirectCount: 1,
        timeoutMs: 8_000,
        contentType: "text/html",
        contentLength: "1234",
        errorCode: null,
      },
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(info.mock.calls)).not.toContain("private");
  });

  it("logs only safe failure details", () => {
    process.env.EXTERNAL_REQUEST_DEBUG = "true";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logExternalRequestFailure({
      provider: "Gemini",
      action: "job extraction",
      method: "POST",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent?key=secret",
      durationMs: 20_000,
      timeoutMs: 20_000,
      error: new AppError("Provider message with secret", 504, "MODEL_TIMEOUT"),
    });

    expect(warn).toHaveBeenCalledWith(
      "External request failed: Gemini job extraction POST https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent",
      expect.objectContaining({ errorCode: "MODEL_TIMEOUT" }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Provider message");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
  });

  it("does not log prompts by default", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logExternalRequestPrompt({
      provider: "Ollama",
      action: "job extraction",
      model: "qwen3:8b",
      prompt: "UNTRUSTED JOB CONTENT START\nprivate job text\nUNTRUSTED JOB CONTENT END",
    });

    expect(info).not.toHaveBeenCalled();
  });

  it("keeps prompt logs disabled when only metadata debug is enabled", () => {
    process.env.EXTERNAL_REQUEST_DEBUG = "true";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logExternalRequestPrompt({
      provider: "Gemini",
      action: "job extraction",
      model: "gemini-2.5-flash-lite",
      prompt: "exact prompt",
    });

    expect(info).not.toHaveBeenCalled();
  });

  it("logs the exact prompt when prompt debug is enabled", () => {
    process.env.EXTERNAL_REQUEST_PROMPT_DEBUG = "true";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const prompt = "UNTRUSTED CV CONTENT START\nPrivate CV text\nUNTRUSTED CV CONTENT END";

    logExternalRequestPrompt({
      provider: "Ollama",
      action: "CV analysis",
      model: "qwen3:8b",
      prompt,
    });

    expect(info).toHaveBeenCalledWith("External request prompt: Ollama CV analysis", {
      provider: "Ollama",
      action: "CV analysis",
      model: "qwen3:8b",
      prompt,
    });
  });
});
