import { AppError } from "./errors";
import { buildExtractionPrompt } from "./extraction-prompt";
import { jobRequirementsSchema } from "./schema";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen3:8b";
const TIMEOUT_MS = 60_000;

const responseSchema = {
  type: "object",
  properties: {
    title: { type: ["string", "null"] },
    company: { type: ["string", "null"] },
    location: { type: ["string", "null"], description: "Geographic job location only; null when none is stated." },
    remoteMode: { type: ["string", "null"], description: "Work arrangement: remote, hybrid, or on-site." },
    employmentType: { type: ["string", "null"], description: "Employment or contract type, such as full-time, part-time, or contract." },
    requiredSkills: { type: "array", items: { type: "string" } },
    preferredSkills: { type: "array", items: { type: "string" } },
    minimumExperience: { type: ["string", "null"] },
    education: { type: ["string", "null"] },
    responsibilities: { type: "array", items: { type: "string" } },
    salary: { type: ["string", "null"] },
    applicationDeadline: { type: ["string", "null"] },
    summary: { type: ["string", "null"] },
  },
  required: [
    "title", "company", "location", "remoteMode", "employmentType",
    "requiredSkills", "preferredSkills", "minimumExperience", "education",
    "responsibilities", "salary", "applicationDeadline", "summary",
  ],
  additionalProperties: false,
} as const;

type OllamaResponse = { response?: string; error?: string };

function getGenerateUrl() {
  const configuredUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_BASE_URL;
  try {
    const baseUrl = new URL(configuredUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") throw new Error("Unsupported protocol");
    return new URL("api/generate", `${baseUrl.toString().replace(/\/$/, "")}/`).toString();
  } catch {
    throw new AppError("OLLAMA_BASE_URL is invalid. Use a URL such as http://127.0.0.1:11434.", 503, "INVALID_OLLAMA_URL");
  }
}

export async function extractWithOllama(content: string) {
  const model = process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(getGenerateUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: buildExtractionPrompt(content),
        stream: false,
        think: false,
        format: responseSchema,
        options: { temperature: 0 },
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null) as OllamaResponse | null;
    if (!response.ok) {
      if (response.status === 404 || /model.+not found/i.test(body?.error ?? "")) {
        throw new AppError(`Ollama model ${model} is not installed. Run: ollama pull ${model}`, 503, "OLLAMA_MODEL_NOT_FOUND");
      }
      throw new AppError("Ollama could not process this job description. Make sure the local model is available.", 502, "OLLAMA_ERROR");
    }

    if (typeof body?.response !== "string") {
      throw new AppError("Ollama returned an invalid response. Please try again.", 502, "INVALID_MODEL_OUTPUT");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body.response);
    } catch {
      throw new AppError("Ollama returned malformed JSON. Please try again.", 502, "MALFORMED_JSON");
    }

    const validated = jobRequirementsSchema.safeParse(parsed);
    if (!validated.success) throw new AppError("Ollama returned an invalid result. Please try again.", 502, "INVALID_MODEL_OUTPUT");
    return validated.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("Ollama took too long to respond. Please try again.", 504, "MODEL_TIMEOUT");
    }
    throw new AppError("Cannot connect to Ollama. Start the Ollama desktop app and try again.", 503, "OLLAMA_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}
