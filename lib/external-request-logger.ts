import { AppError } from "./errors";

type ExternalRequestLogDetails = {
  action: string;
  contentLength?: number | string | null;
  contentType?: string | null;
  durationMs?: number;
  errorCode?: string;
  method: string;
  model?: string;
  provider: string;
  redirectCount?: number;
  status?: number;
  timeoutMs?: number;
  url?: string | URL;
};

function isDebugEnabled() {
  return process.env.EXTERNAL_REQUEST_DEBUG?.trim().toLowerCase() === "true";
}

function sanitizeUrl(url: string | URL | undefined) {
  if (!url) return undefined;
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

function baseMessage(phase: "started" | "completed" | "failed", details: ExternalRequestLogDetails) {
  const url = sanitizeUrl(details.url);
  const target = url ?? details.provider;
  return `External request ${phase}: ${details.provider} ${details.action} ${details.method} ${target}`;
}

function debugDetails(details: ExternalRequestLogDetails) {
  return {
    provider: details.provider,
    action: details.action,
    method: details.method,
    url: sanitizeUrl(details.url) ?? null,
    model: details.model ?? null,
    status: details.status ?? null,
    durationMs: details.durationMs ?? null,
    redirectCount: details.redirectCount ?? null,
    timeoutMs: details.timeoutMs ?? null,
    contentType: details.contentType ?? null,
    contentLength: details.contentLength ?? null,
    errorCode: details.errorCode ?? null,
  };
}

function logInfo(phase: "started" | "completed", details: ExternalRequestLogDetails) {
  const message = baseMessage(phase, details);
  if (isDebugEnabled()) {
    console.info(message, debugDetails(details));
    return;
  }
  console.info(message);
}

export function getExternalRequestErrorCode(error: unknown) {
  return error instanceof AppError ? error.code : undefined;
}

export function logExternalRequestStart(details: ExternalRequestLogDetails) {
  logInfo("started", details);
}

export function logExternalRequestEnd(details: ExternalRequestLogDetails) {
  logInfo("completed", details);
}

export function logExternalRequestFailure(details: ExternalRequestLogDetails & { error?: unknown }) {
  const message = baseMessage("failed", details);
  const safeDetails = {
    ...details,
    errorCode: details.errorCode ?? getExternalRequestErrorCode(details.error),
  };
  if (isDebugEnabled()) {
    console.warn(message, debugDetails(safeDetails));
    return;
  }
  console.warn(message);
}
