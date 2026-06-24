import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { AppError } from "./errors";
import { buildExtractionPrompt } from "./extraction-prompt";
import { jobRequirementsSchema } from "./schema";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const TIMEOUT_MS = 20_000;

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, nullable: true }, company: { type: SchemaType.STRING, nullable: true },
    location: { type: SchemaType.STRING, nullable: true }, remoteMode: { type: SchemaType.STRING, nullable: true },
    employmentType: { type: SchemaType.STRING, nullable: true }, requiredSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    preferredSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }, minimumExperience: { type: SchemaType.STRING, nullable: true },
    education: { type: SchemaType.STRING, nullable: true }, responsibilities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    salary: { type: SchemaType.STRING, nullable: true }, applicationDeadline: { type: SchemaType.STRING, nullable: true }, summary: { type: SchemaType.STRING, nullable: true },
  },
  required: ["title", "company", "location", "remoteMode", "employmentType", "requiredSkills", "preferredSkills", "minimumExperience", "education", "responsibilities", "salary", "applicationDeadline", "summary"],
};

type GeminiErrorDetail = {
  "@type"?: string;
  retryDelay?: string;
  violations?: Array<{ quotaValue?: string | number }>;
};

type GeminiProviderError = Error & {
  status?: number;
  statusText?: string;
  errorDetails?: GeminiErrorDetail[];
};

function getRetryAfterSeconds(details: GeminiErrorDetail[]) {
  const retryInfo = details.find((detail) => detail["@type"]?.endsWith("RetryInfo"));
  const match = retryInfo?.retryDelay?.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.max(1, Math.ceil(Number(match[1]))) : undefined;
}

function hasZeroQuota(details: GeminiErrorDetail[], message: string) {
  const quotaIsZero = details.some((detail) =>
    detail.violations?.some(({ quotaValue }) => Number(quotaValue) === 0),
  );
  return quotaIsZero || /(?:limit|quota(?: value)?)\s*[:=]?\s*0\b/i.test(message);
}

export function classifyGeminiError(error: unknown) {
  if (error instanceof AppError) return error;
  if (error instanceof SyntaxError) return new AppError("Gemini returned malformed JSON. Please try again.", 502, "MALFORMED_JSON");

  const providerError = error as Partial<GeminiProviderError>;
  const message = providerError.message ?? "";
  const status = providerError.status ?? (/\b429\b/.test(message) ? 429 : undefined);
  const details = Array.isArray(providerError.errorDetails) ? providerError.errorDetails : [];

  if (status === 400 || status === 401 || status === 403 || /API_KEY_INVALID|API key not valid|permission denied|key.+restrict/i.test(message)) {
    return new AppError("The Gemini API key is invalid, restricted, or cannot access this model. Check the server key and its Google AI Studio project.", 503, "INVALID_API_KEY");
  }

  if (status === 429 || /quota|rate limit|resource exhausted/i.test(message)) {
    const retryAfterSeconds = getRetryAfterSeconds(details);
    if (retryAfterSeconds && !hasZeroQuota(details, message)) {
      return new AppError(`Gemini is temporarily rate-limited. Try again in about ${retryAfterSeconds} seconds.`, 429, "RATE_LIMITED", retryAfterSeconds);
    }
    return new AppError("No Gemini free-tier quota is available for this API project. Check the key’s project and free-tier access in Google AI Studio.", 503, "QUOTA_UNAVAILABLE");
  }

  if (status === 503 || /high demand|service unavailable|model.+overloaded/i.test(message)) {
    return new AppError("Gemini is currently experiencing high demand. Please try again later.", 503, "MODEL_BUSY");
  }

  console.error("Gemini request failed", {
    name: providerError.name ?? "UnknownError",
    status: status ?? null,
    statusText: providerError.statusText ?? null,
    message: message.replace(/([?&]key=)[^&\s]+/gi, "$1<redacted>"),
  });
  return new AppError("Gemini could not process this job description. Please try again.", 502, "MODEL_ERROR");
}

function withTimeout<T>(promise: Promise<T>) {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new AppError("Gemini took too long to respond. Try again.", 504, "MODEL_TIMEOUT")), TIMEOUT_MS);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

export async function extractWithGemini(content: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError("Gemini is not configured. Add GEMINI_API_KEY to the server environment.", 503, "MISSING_API_KEY");
  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json", responseSchema } });
  const prompt = buildExtractionPrompt(content);
  try {
    const result = await withTimeout(model.generateContent(prompt));
    const parsed = JSON.parse(result.response.text());
    const validated = jobRequirementsSchema.safeParse(parsed);
    if (!validated.success) throw new AppError("Gemini returned an invalid result. Please try again.", 502, "INVALID_MODEL_OUTPUT");
    return validated.data;
  } catch (error) {
    throw classifyGeminiError(error);
  }
}
