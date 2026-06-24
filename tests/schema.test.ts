import { describe, expect, it } from "vitest";
import { extractRequestSchema, jobRequirementsSchema } from "@/lib/schema";

const validResult = {
  title: "Frontend Engineer", company: null, location: null, remoteMode: null,
  employmentType: null, requiredSkills: ["React"], preferredSkills: [],
  minimumExperience: "3 years", education: null, responsibilities: ["Build interfaces"],
  salary: null, applicationDeadline: null, summary: "Build accessible web interfaces.",
};

describe("job requirements schema", () => {
  it("accepts absent optional facts as null and empty arrays", () => {
    expect(jobRequirementsSchema.parse(validResult)).toEqual(validResult);
  });

  it("rejects model-added fields", () => {
    expect(() => jobRequirementsSchema.parse({ ...validResult, inventedScore: 99 })).toThrow();
  });
});

describe("extract request schema", () => {
  it("rejects empty input", () => {
    expect(extractRequestSchema.safeParse({ inputType: "text", content: "  " }).success).toBe(false);
  });

  it("rejects excessively long text and URLs", () => {
    expect(extractRequestSchema.safeParse({ inputType: "text", content: "a".repeat(50_001) }).success).toBe(false);
    expect(extractRequestSchema.safeParse({ inputType: "url", content: "a".repeat(2_049) }).success).toBe(false);
  });
});
