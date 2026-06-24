import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extractWithGemini: vi.fn(),
  extractWithOllama: vi.fn(),
}));

vi.mock("@/lib/gemini", () => ({ extractWithGemini: mocks.extractWithGemini }));
vi.mock("@/lib/ollama", () => ({ extractWithOllama: mocks.extractWithOllama }));

import { extractJobRequirements } from "@/lib/extractor";

afterEach(() => {
  delete process.env.AI_PROVIDER;
  mocks.extractWithGemini.mockReset();
  mocks.extractWithOllama.mockReset();
});

describe("AI provider selection", () => {
  it("uses Ollama when configured", async () => {
    process.env.AI_PROVIDER = "ollama";
    mocks.extractWithOllama.mockResolvedValue({ provider: "ollama" });
    await expect(extractJobRequirements("job")).resolves.toEqual({ provider: "ollama" });
    expect(mocks.extractWithGemini).not.toHaveBeenCalled();
  });

  it("uses Gemini when configured and by default", async () => {
    mocks.extractWithGemini.mockResolvedValue({ provider: "gemini" });
    await expect(extractJobRequirements("job")).resolves.toEqual({ provider: "gemini" });
    process.env.AI_PROVIDER = "gemini";
    await extractJobRequirements("job");
    expect(mocks.extractWithGemini).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported providers", async () => {
    process.env.AI_PROVIDER = "other";
    await expect(extractJobRequirements("job")).rejects.toMatchObject({ code: "INVALID_AI_PROVIDER" });
  });
});
