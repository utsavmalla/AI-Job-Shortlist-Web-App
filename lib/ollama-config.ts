import { AppError } from "./errors";

export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "qwen3:8b";

export function getOllamaGenerateUrl() {
  const configuredUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL;
  try {
    const baseUrl = new URL(configuredUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") throw new Error("Unsupported protocol");
    return new URL("api/generate", `${baseUrl.toString().replace(/\/$/, "")}/`).toString();
  } catch {
    throw new AppError("OLLAMA_BASE_URL is invalid. Use a URL such as http://127.0.0.1:11434 or https://ollama.com.", 503, "INVALID_OLLAMA_URL");
  }
}

export function getOllamaModel() {
  return process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;
}

export function getOllamaHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

export function getOllamaUnavailableMessage() {
  return process.env.OLLAMA_API_KEY?.trim()
    ? "Cannot connect to Ollama Cloud. Check OLLAMA_BASE_URL, OLLAMA_API_KEY, and your Ollama account usage."
    : "Cannot connect to Ollama. Start the Ollama desktop app or configure OLLAMA_BASE_URL for a reachable Ollama service.";
}

export function getOllamaModelNotFoundMessage(model: string) {
  return process.env.OLLAMA_API_KEY?.trim()
    ? `Ollama model ${model} is not available for this API key. Check the configured OLLAMA_MODEL.`
    : `Ollama model ${model} is not installed. Run: ollama pull ${model}`;
}

export function getOllamaProviderErrorMessage(action: "analyze this CV" | "process this job description") {
  return process.env.OLLAMA_API_KEY?.trim()
    ? `Ollama Cloud could not ${action}. Check your model access and usage limits.`
    : `Ollama could not ${action}. Make sure the configured model is available.`;
}

export function classifyOllamaHttpError(status: number, model: string, action: "analyze this CV" | "process this job description") {
  if (status === 401) {
    return new AppError("Ollama Cloud rejected the API key. Check OLLAMA_API_KEY.", 503, "OLLAMA_INVALID_API_KEY");
  }
  if (status === 403) {
    return new AppError(`Ollama Cloud denied access to model ${model}. Choose a model available to this API key.`, 503, "OLLAMA_MODEL_ACCESS_DENIED");
  }
  if (status === 429) {
    return new AppError("Ollama Cloud rate limit or usage limit was reached. Try again later or choose another model.", 429, "OLLAMA_RATE_LIMITED", 30);
  }
  return new AppError(getOllamaProviderErrorMessage(action), 502, "OLLAMA_ERROR");
}
