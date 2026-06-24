import { AppError } from "./errors";
import { extractWithGemini } from "./gemini";
import { extractWithOllama } from "./ollama";

export async function extractJobRequirements(content: string) {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || "gemini";

  if (provider === "ollama") return extractWithOllama(content);
  if (provider === "gemini") return extractWithGemini(content);

  throw new AppError("AI_PROVIDER must be either ollama or gemini.", 503, "INVALID_AI_PROVIDER");
}
