import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeCvWithOllama } from "@/lib/cv-analyzer";
import { extractCvText, MAX_CV_FILE_BYTES } from "@/lib/cv-document";
import { AppError } from "@/lib/errors";
import { cvGuidelineSchema } from "@/lib/schema";
import { extractTextFromUrl } from "@/lib/url-content";

export const runtime = "nodejs";

const MAX_MULTIPART_BYTES = MAX_CV_FILE_BYTES + 100_000;

const formFieldsSchema = z
  .object({
    guidelines: z.array(cvGuidelineSchema).min(1, "Select at least one analysis guideline.").max(6),
    jobInputType: z.enum(["text", "url"]).nullable(),
    jobContent: z.string(),
  })
  .superRefine((value, context) => {
    if (new Set(value.guidelines).size !== value.guidelines.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["guidelines"], message: "Guidelines must be unique." });
    }
    const needsJob = value.guidelines.includes("jobMatch");
    if (needsJob && (!value.jobInputType || !value.jobContent.trim())) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["jobContent"], message: "Add a job description or public job URL for job matching." });
    }
    const limit = value.jobInputType === "url" ? 2_048 : 50_000;
    if (value.jobContent.length > limit) {
      context.addIssue({ code: z.ZodIssueCode.too_big, maximum: limit, inclusive: true, type: "string", path: ["jobContent"], message: "Job input is too long." });
    }
  });

function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    const body = { error: error.message, code: error.code, ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) };
    const headers = error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : undefined;
    return NextResponse.json(body, { status: error.status, headers });
  }
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
      throw new AppError("CV files must be 5 MB or smaller.", 413, "CV_FILE_TOO_LARGE");
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) throw new AppError("Submit the CV analysis form again.", 400, "INVALID_INPUT");

    const file = formData.get("cv");
    if (!(file instanceof File)) throw new AppError("Upload a PDF or DOCX CV.", 400, "CV_FILE_REQUIRED");

    let rawGuidelines: unknown;
    try {
      rawGuidelines = JSON.parse(String(formData.get("guidelines") ?? ""));
    } catch {
      throw new AppError("Select at least one valid analysis guideline.", 400, "INVALID_GUIDELINES");
    }

    const rawJobInputType = String(formData.get("jobInputType") ?? "").trim();
    const parsed = formFieldsSchema.safeParse({
      guidelines: rawGuidelines,
      jobInputType: rawJobInputType || null,
      jobContent: String(formData.get("jobContent") ?? ""),
    });
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid analysis options.", 400, "INVALID_INPUT");
    }

    const cvTextPromise = extractCvText(file);
    const needsJob = parsed.data.guidelines.includes("jobMatch");
    const jobPromise = needsJob && parsed.data.jobInputType === "url"
      ? extractTextFromUrl(parsed.data.jobContent.trim()).then((result) => result.text)
      : Promise.resolve(needsJob ? parsed.data.jobContent.trim() : null);
    const [cvText, jobText] = await Promise.all([cvTextPromise, jobPromise]);
    const result = await analyzeCvWithOllama(cvText, parsed.data.guidelines, jobText);
    return NextResponse.json({ result, fileName: file.name });
  } catch (error) {
    return errorResponse(error);
  }
}
