import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { extractJobRequirements } from "@/lib/extractor";
import { extractRequestSchema } from "@/lib/schema";
import { extractTextFromUrl } from "@/lib/url-content";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = extractRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request.", code: "INVALID_INPUT" }, { status: 400 });
    const source = parsed.data.inputType === "url" ? await extractTextFromUrl(parsed.data.content) : { text: parsed.data.content, sourceUrl: null };
    const result = await extractJobRequirements(source.text);
    return NextResponse.json({ result, source: { type: parsed.data.inputType, url: source.sourceUrl } });
  } catch (error) {
    if (error instanceof AppError) {
      const body = { error: error.message, code: error.code, ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) };
      const headers = error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : undefined;
      return NextResponse.json(body, { status: error.status, headers });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
