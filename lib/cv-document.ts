import mammoth from "mammoth";
import { AppError } from "./errors";

export const MAX_CV_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_CV_TEXT_LENGTH = 50_000;

const PDF_MIME_TYPES = new Set(["application/pdf"]);
const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

function hasPdfSignature(buffer: Buffer) {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function hasZipSignature(buffer: Buffer) {
  const signature = buffer.subarray(0, 4).toString("hex");
  return signature === "504b0304" || signature === "504b0506" || signature === "504b0708";
}

function normalizeExtractedText(text: string) {
  const normalized = text.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (normalized.length < 20) {
    throw new AppError(
      "We could not find readable text in this CV. Upload a text-based PDF or DOCX file.",
      422,
      "CV_TEXT_NOT_FOUND",
    );
  }
  if (normalized.length > MAX_CV_TEXT_LENGTH) {
    throw new AppError("The extracted CV text is too long.", 413, "CV_TEXT_TOO_LONG");
  }
  return normalized;
}

async function extractPdf(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function extractCvText(file: File) {
  if (file.size === 0) throw new AppError("The uploaded CV is empty.", 400, "EMPTY_CV_FILE");
  if (file.size > MAX_CV_FILE_BYTES) throw new AppError("CV files must be 5 MB or smaller.", 413, "CV_FILE_TOO_LARGE");

  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (extension !== ".pdf" && extension !== ".docx") {
    throw new AppError("Upload a PDF or DOCX CV.", 400, "UNSUPPORTED_CV_TYPE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (extension === ".pdf" && (!PDF_MIME_TYPES.has(file.type) || !hasPdfSignature(buffer))) {
    throw new AppError("This file is not a valid PDF.", 400, "INVALID_CV_FILE");
  }
  if (extension === ".docx" && (!DOCX_MIME_TYPES.has(file.type) || !hasZipSignature(buffer))) {
    throw new AppError("This file is not a valid DOCX document.", 400, "INVALID_CV_FILE");
  }

  try {
    const text = extension === ".pdf"
      ? await extractPdf(buffer)
      : (await mammoth.extractRawText({ buffer })).value;
    return normalizeExtractedText(text);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "We could not read this CV. It may be encrypted, damaged, or unsupported.",
      422,
      "CV_PARSE_FAILED",
    );
  }
}
