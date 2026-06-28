import { describe, expect, it } from "vitest";
import { buildExtractionPrompt } from "@/lib/extraction-prompt";

describe("buildExtractionPrompt", () => {
  it("states the exact raw JSON contract and preserves the untrusted content boundary", () => {
    const prompt = buildExtractionPrompt("React role");

    expect(prompt).toContain("Return raw JSON only");
    expect(prompt).toContain("Do not wrap the response in Markdown, code fences, or explanatory text.");
    expect(prompt).toContain("Use null for missing scalar fields and [] for missing list fields.");
    expect(prompt).toContain("Do not use snake_case, title case, aliases, or extra fields.");
    expect(prompt).toContain("UNTRUSTED JOB CONTENT START\nReact role\nUNTRUSTED JOB CONTENT END");

    for (const property of [
      "title",
      "company",
      "location",
      "remoteMode",
      "employmentType",
      "requiredSkills",
      "preferredSkills",
      "minimumExperience",
      "education",
      "responsibilities",
      "salary",
      "applicationDeadline",
      "summary",
    ]) {
      expect(prompt).toContain(`"${property}"`);
    }
  });
});
