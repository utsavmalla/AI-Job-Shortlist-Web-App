import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), extractCv: vi.fn(), extractUrl: vi.fn() }));
vi.mock("@/lib/cv-analyzer", () => ({ analyzeCvWithOllama: mocks.analyze }));
vi.mock("@/lib/cv-document", () => ({ extractCvText: mocks.extractCv, MAX_CV_FILE_BYTES: 5 * 1024 * 1024 }));
vi.mock("@/lib/url-content", () => ({ extractTextFromUrl: mocks.extractUrl }));

import { POST } from "@/app/api/analyze-cv/route";

function makeRequest(fields: { guidelines?: string[]; jobInputType?: string; jobContent?: string; includeFile?: boolean }) {
  const body = new FormData();
  if (fields.includeFile !== false) body.set("cv", new File(["fake"], "cv.pdf", { type: "application/pdf" }));
  body.set("guidelines", JSON.stringify(fields.guidelines ?? ["skills"]));
  body.set("jobInputType", fields.jobInputType ?? "");
  body.set("jobContent", fields.jobContent ?? "");
  return new Request("http://test/api/analyze-cv", { method: "POST", body });
}

beforeEach(() => {
  mocks.analyze.mockReset().mockResolvedValue({ overallScore: 80 });
  mocks.extractCv.mockReset().mockResolvedValue("CV text");
  mocks.extractUrl.mockReset();
});

describe("POST /api/analyze-cv", () => {
  it("requires a file and at least one valid unique guideline", async () => {
    expect((await POST(makeRequest({ includeFile: false }))).status).toBe(400);
    expect((await POST(makeRequest({ guidelines: [] }))).status).toBe(400);
    expect((await POST(makeRequest({ guidelines: ["skills", "skills"] }))).status).toBe(400);
    expect((await POST(makeRequest({ guidelines: ["invented"] }))).status).toBe(400);
  });

  it("requires job content only for job matching", async () => {
    const missingJob = await POST(makeRequest({ guidelines: ["jobMatch"], jobInputType: "text" }));
    expect(missingJob.status).toBe(400);

    const response = await POST(makeRequest({ guidelines: ["skills"] }));
    expect(response.status).toBe(200);
    expect(mocks.analyze).toHaveBeenCalledWith("CV text", ["skills"], null);
  });

  it("retrieves protected URL content before local analysis", async () => {
    mocks.extractUrl.mockResolvedValue({ text: "Job text", sourceUrl: "https://example.com/job" });
    const response = await POST(makeRequest({ guidelines: ["jobMatch", "skills"], jobInputType: "url", jobContent: "https://example.com/job" }));
    expect(response.status).toBe(200);
    expect(mocks.extractUrl).toHaveBeenCalledWith("https://example.com/job");
    expect(mocks.analyze).toHaveBeenCalledWith("CV text", ["jobMatch", "skills"], "Job text");
  });
});
