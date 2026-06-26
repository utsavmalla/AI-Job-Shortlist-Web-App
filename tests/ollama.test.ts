import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractWithOllama } from "@/lib/ollama";

const validResult = {
  title: "Frontend Engineer", company: "Example Co", location: null, remoteMode: "Remote",
  employmentType: null, requiredSkills: ["React"], preferredSkills: [], minimumExperience: "3 years",
  education: null, responsibilities: ["Build interfaces"], salary: null,
  applicationDeadline: null, summary: "Build accessible web interfaces.",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";
  process.env.OLLAMA_MODEL = "qwen3:8b";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OLLAMA_API_KEY;
});

describe("Ollama extraction", () => {
  it("uses the configured endpoint and model with structured output", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ response: JSON.stringify(validResult) })));

    await expect(extractWithOllama("React role")).resolves.toEqual(validResult);
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:11434/api/generate", expect.objectContaining({ method: "POST" }));

    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({ model: "qwen3:8b", stream: false, think: false, options: { temperature: 0 } });
    expect(body.format).toMatchObject({ type: "object", additionalProperties: false });
    expect(request?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("supports Ollama Cloud API keys and cloud model names", async () => {
    process.env.OLLAMA_BASE_URL = "https://ollama.com";
    process.env.OLLAMA_MODEL = "gpt-oss:20b";
    process.env.OLLAMA_API_KEY = "test-ollama-key";
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ response: JSON.stringify(validResult) })));

    await expect(extractWithOllama("React role")).resolves.toEqual(validResult);
    expect(fetch).toHaveBeenCalledWith("https://ollama.com/api/generate", expect.objectContaining({
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-ollama-key",
      },
      method: "POST",
    }));

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("gpt-oss:20b");
  });

  it("rejects malformed JSON and model-added fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ response: "not-json" })));
    await expect(extractWithOllama("React role")).rejects.toMatchObject({ code: "MALFORMED_JSON" });

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ response: JSON.stringify({ ...validResult, inventedScore: 99 }) })));
    await expect(extractWithOllama("React role")).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("reports an unavailable local server without falling back", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    await expect(extractWithOllama("React role")).rejects.toMatchObject({ code: "OLLAMA_UNAVAILABLE", status: 503 });
  });

  it("reports a missing model with the pull command", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "model not found" }), { status: 404 }));
    await expect(extractWithOllama("React role")).rejects.toMatchObject({ code: "OLLAMA_MODEL_NOT_FOUND", status: 503 });
  });

  it("reports cloud model access denial clearly", async () => {
    process.env.OLLAMA_BASE_URL = "https://ollama.com";
    process.env.OLLAMA_MODEL = "qwen3.5:cloud";
    process.env.OLLAMA_API_KEY = "test-ollama-key";
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }));

    await expect(extractWithOllama("React role")).rejects.toMatchObject({
      code: "OLLAMA_MODEL_ACCESS_DENIED",
      status: 503,
    });
  });
});
