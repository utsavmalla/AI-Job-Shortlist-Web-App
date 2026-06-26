import { AppError } from "./errors";
import { buildExtractionPrompt } from "./extraction-prompt";
import {
  classifyOllamaHttpError,
  getOllamaGenerateUrl,
  getOllamaHeaders,
  getOllamaModel,
  getOllamaModelNotFoundMessage,
  getOllamaUnavailableMessage,
} from "./ollama-config";
import { jobRequirementsSchema } from "./schema";

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

export async function extractWithOllama(content: string) {
  const model = getOllamaModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(getOllamaGenerateUrl(), {
      method: "POST",
      headers: getOllamaHeaders(),
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
        throw new AppError(getOllamaModelNotFoundMessage(model), 503, "OLLAMA_MODEL_NOT_FOUND");
      }
      throw classifyOllamaHttpError(response.status, model, "process this job description");
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
    throw new AppError(getOllamaUnavailableMessage(), 503, "OLLAMA_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}
