import dns from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { AppError } from "./errors";
import { logExternalRequestEnd, logExternalRequestFailure, logExternalRequestStart } from "./external-request-logger";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_EXTRACTED_CHARS = 50_000;
const MAX_REDIRECTS = 3;

function isPrivateAddress(address: string) {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
  );
}

export async function assertPublicUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError("Enter a valid public HTTP or HTTPS URL.", 400, "INVALID_URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new AppError("Only public HTTP or HTTPS URLs are supported.", 400, "INVALID_URL");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new AppError("Private-network URLs are not supported.", 400, "PRIVATE_URL");
  }
  const addresses = isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new AppError("The job page could not be found.", 422, "FETCH_FAILED");
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new AppError("Private-network URLs are not supported.", 400, "PRIVATE_URL");
  }
  return url;
}

async function fetchPage(url: URL, redirects = 0): Promise<Response> {
  const startedAt = Date.now();
  logExternalRequestStart({ provider: "Job URL", action: "page fetch", method: "GET", url, redirectCount: redirects, timeoutMs: FETCH_TIMEOUT_MS });
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "JobRequirementsExtractor/1.0", Accept: "text/html,application/xhtml+xml" },
  }).catch((error: unknown) => {
    const appError = error instanceof DOMException && error.name === "TimeoutError"
      ? new AppError("The job page took too long to respond. Paste the job description instead.", 504, "FETCH_TIMEOUT")
      : new AppError("This site blocked or failed retrieval. Paste the job description instead.", 422, "FETCH_FAILED");
    logExternalRequestFailure({
      provider: "Job URL",
      action: "page fetch",
      method: "GET",
      url,
      redirectCount: redirects,
      durationMs: Date.now() - startedAt,
      timeoutMs: FETCH_TIMEOUT_MS,
      error: appError,
    });
    throw appError;
  });
  logExternalRequestEnd({
    provider: "Job URL",
    action: "page fetch",
    method: "GET",
    url,
    redirectCount: redirects,
    status: response.status,
    durationMs: Date.now() - startedAt,
    timeoutMs: FETCH_TIMEOUT_MS,
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length"),
  });
  if (response.status >= 300 && response.status < 400) {
    if (redirects >= MAX_REDIRECTS) throw new AppError("The job page redirected too many times.", 422, "FETCH_FAILED");
    const location = response.headers.get("location");
    if (!location) throw new AppError("The job page returned an invalid redirect.", 422, "FETCH_FAILED");
    return fetchPage(await assertPublicUrl(new URL(location, url).toString()), redirects + 1);
  }
  return response;
}

export async function extractTextFromUrl(rawUrl: string) {
  const url = await assertPublicUrl(rawUrl);
  const response = await fetchPage(url);
  if (!response.ok) throw new AppError("This site blocked or failed retrieval. Paste the job description instead.", 422, "FETCH_FAILED");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new AppError("Only HTML job pages are supported.", 415, "UNSUPPORTED_CONTENT");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new AppError("This page is too large to process.", 413, "PAGE_TOO_LARGE");

  const reader = response.body?.getReader();
  if (!reader) throw new AppError("The job page had no readable content.", 422, "NO_CONTENT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new AppError("This page is too large to process.", 413, "PAGE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const html = new TextDecoder().decode(Buffer.concat(chunks));
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, header, form, iframe").remove();
  const text = ($("main, article, [role='main']").first().text() || $("body").text()).replace(/\s+/g, " ").trim();
  if (text.length < 100 || /sign in|log in to continue|enable javascript/i.test(text.slice(0, 1_000))) {
    throw new AppError("This page does not expose a readable job description. Paste the job description instead.", 422, "NO_CONTENT");
  }
  return { text: text.slice(0, MAX_EXTRACTED_CHARS), sourceUrl: url.toString() };
}
