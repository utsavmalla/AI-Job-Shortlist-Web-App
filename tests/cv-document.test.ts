import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pdfText: vi.fn(), docxText: vi.fn(), destroy: vi.fn() }));
vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getText = mocks.pdfText;
    destroy = mocks.destroy;
  },
}));
vi.mock("mammoth", () => ({ default: { extractRawText: mocks.docxText } }));

import { extractCvText, MAX_CV_FILE_BYTES } from "@/lib/cv-document";

beforeEach(() => {
  mocks.pdfText.mockReset();
  mocks.docxText.mockReset();
  mocks.destroy.mockReset();
});

describe("CV document extraction", () => {
  it("validates and extracts PDF and DOCX text", async () => {
    mocks.pdfText.mockResolvedValue({ text: "Frontend engineer with extensive React experience." });
    const pdf = new File([Buffer.from("%PDF-example")], "cv.pdf", { type: "application/pdf" });
    await expect(extractCvText(pdf)).resolves.toContain("Frontend engineer");
    expect(mocks.destroy).toHaveBeenCalled();

    mocks.docxText.mockResolvedValue({ value: "Frontend engineer with TypeScript and Node.js experience." });
    const docx = new File([Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])], "cv.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    await expect(extractCvText(docx)).resolves.toContain("TypeScript");
  });

  it("rejects unsupported, spoofed, oversized, and empty files", async () => {
    await expect(extractCvText(new File(["hello"], "cv.txt", { type: "text/plain" }))).rejects.toMatchObject({ code: "UNSUPPORTED_CV_TYPE" });
    await expect(extractCvText(new File(["not pdf"], "cv.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ code: "INVALID_CV_FILE" });
    await expect(extractCvText(new File([], "cv.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ code: "EMPTY_CV_FILE" });
    await expect(extractCvText(new File([new Uint8Array(MAX_CV_FILE_BYTES + 1)], "cv.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ code: "CV_FILE_TOO_LARGE" });
  });

  it("rejects image-only or unreadable content", async () => {
    mocks.pdfText.mockResolvedValueOnce({ text: "tiny" });
    const pdf = new File([Buffer.from("%PDF-example")], "cv.pdf", { type: "application/pdf" });
    await expect(extractCvText(pdf)).rejects.toMatchObject({ code: "CV_TEXT_NOT_FOUND" });
  });
});
