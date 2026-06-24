import { z } from "zod";

const nullableText = z.string().trim().min(1).nullable();

export const jobRequirementsSchema = z
  .object({
    title: nullableText,
    company: nullableText,
    location: nullableText,
    remoteMode: nullableText,
    employmentType: nullableText,
    requiredSkills: z.array(z.string().trim().min(1)),
    preferredSkills: z.array(z.string().trim().min(1)),
    minimumExperience: nullableText,
    education: nullableText,
    responsibilities: z.array(z.string().trim().min(1)),
    salary: nullableText,
    applicationDeadline: nullableText,
    summary: nullableText,
  })
  .strict();

export const extractRequestSchema = z
  .object({
    inputType: z.enum(["text", "url"]),
    content: z.string().trim().min(1, "Enter a job description or URL."),
  })
  .superRefine((value, context) => {
    const limit = value.inputType === "text" ? 50_000 : 2_048;
    if (value.content.length > limit) {
      context.addIssue({ code: z.ZodIssueCode.too_big, maximum: limit, type: "string", inclusive: true, message: "Input is too long." });
    }
  });

export type JobRequirements = z.infer<typeof jobRequirementsSchema>;

export const cvGuidelineIds = [
  "jobMatch",
  "skills",
  "experience",
  "education",
  "clarity",
  "atsReadiness",
] as const;

export const cvGuidelineSchema = z.enum(cvGuidelineIds);

export const cvGuidelineLabels: Record<z.infer<typeof cvGuidelineSchema>, string> = {
  jobMatch: "Job requirements match",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  clarity: "Clarity and impact",
  atsReadiness: "ATS readiness",
};

const score = z.number().int().min(0).max(100);
const nonEmptyTextList = z.array(z.string().trim().min(1));

export const cvCriterionResultSchema = z
  .object({
    guideline: cvGuidelineSchema,
    score,
    rationale: z.string().trim().min(1),
    evidence: nonEmptyTextList,
    gaps: nonEmptyTextList,
    recommendations: nonEmptyTextList,
  })
  .strict();

export const cvAnalysisSchema = z
  .object({
    overallScore: score,
    summary: z.string().trim().min(1),
    criteria: z.array(cvCriterionResultSchema).min(1),
    strengths: nonEmptyTextList,
    priorityActions: nonEmptyTextList,
  })
  .strict();

export type CvGuideline = z.infer<typeof cvGuidelineSchema>;
export type CvAnalysis = z.infer<typeof cvAnalysisSchema>;
