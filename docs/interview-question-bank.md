# Intermediate TypeScript, Node.js, React, and Next.js Interview Questions

This question bank is designed for intermediate-level interview preparation. It emphasizes TypeScript and Node.js and uses simplified examples from this repository's CV analyzer and job-requirements extraction workflows.

The snippets are intentionally small enough for an interview discussion. In the application, browser requests, uploaded documents, fetched pages, and AI-model responses are all treated as untrusted data and validated at their boundaries.

## Navigation

- [TypeScript — Questions 1–12](#typescript--questions-112)
- [Node.js — Questions 13–22](#nodejs--questions-1322)
- [React — Questions 23–26](#react--questions-2326)
- [Next.js — Questions 27–30](#nextjs--questions-2730)
- [Senior TypeScript Key Concepts Interview Questions](typescript-key-concepts-interview-questions.md)

## TypeScript — Questions 1–12

### 1. Why use `unknown` for parsed external data?

**Question:** Why should an AI-provider response be parsed as `unknown` instead of asserted directly as `CvAnalysis`?

```ts
let parsed: unknown;

try {
  parsed = JSON.parse(body.response);
} catch {
  throw new AppError("Ollama returned invalid JSON.", 502, "MALFORMED_JSON");
}

const result = cvAnalysisSchema.safeParse(parsed);
```

**Expected answer:** `JSON.parse()` produces runtime data whose shape TypeScript cannot guarantee. Keeping the value as `unknown` prevents unsafe property access until Zod validates and narrows it. Writing `as CvAnalysis` would only silence the compiler; it would not perform a runtime check.

**Key concepts:** `unknown` versus `any`, type narrowing, type assertions, runtime validation, trust boundaries.

**Follow-ups:**

1. What risk would `JSON.parse(body.response) as CvAnalysis` introduce?
2. When is a type assertion appropriate?
3. How does `safeParse` narrow the returned value?

**Practical exercise:** Write a helper that converts a JSON string into `CvAnalysis` and maps malformed JSON and schema failures to stable application errors.

### 2. How does `as const` create a useful union type?

**Question:** Explain the effect of `as const` in this declaration.

```ts
export const cvGuidelineIds = [
  "jobMatch",
  "skills",
  "experience",
  "education",
  "clarity",
  "atsReadiness",
] as const;

export const cvGuidelineSchema = z.enum(cvGuidelineIds);
export type CvGuideline = z.infer<typeof cvGuidelineSchema>;
```

**Expected answer:** `as const` preserves each array item as a string literal and makes the tuple readonly. Zod can use that tuple to create an enum, while `z.infer` produces the union `"jobMatch" | "skills" | ...`. Without it, TypeScript would usually widen the values to `string[]`, losing the finite set of valid IDs.

**Key concepts:** literal widening, readonly tuples, union types, schema-derived types.

**Follow-ups:**

1. What type would TypeScript infer without `as const`?
2. Why is one shared list better than duplicating a TypeScript union and a Zod enum?
3. How would you add a new guideline safely?

### 3. Why infer types from Zod schemas?

**Question:** What are the benefits and limits of deriving a type from a runtime schema?

```ts
export const cvAnalysisSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)),
}).strict();

export type CvAnalysis = z.infer<typeof cvAnalysisSchema>;
```

**Expected answer:** The schema becomes the single source of truth for runtime validation and compile-time use. Changing a field updates the inferred TypeScript type automatically. The inferred type still protects only code checked by TypeScript; untrusted values must pass through the schema before they can safely be treated as `CvAnalysis`.

**Key concepts:** single source of truth, static versus runtime safety, schema inference, drift prevention.

**Follow-ups:**

1. What problem occurs when an interface and its runtime validator are maintained separately?
2. What does `.strict()` change?
3. Would a database result also need runtime validation?

### 4. How does `Record` enforce complete mappings?

**Question:** Why is `Record<CvGuideline, string>` useful for labels?

```ts
export const cvGuidelineLabels: Record<CvGuideline, string> = {
  jobMatch: "Job requirements match",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  clarity: "Clarity and impact",
  atsReadiness: "ATS readiness",
};
```

**Expected answer:** `Record` requires exactly the known guideline keys to map to strings. If a required key is missing or an unsupported key is added in an object literal, TypeScript reports it. It also makes indexed access with a `CvGuideline` safe.

**Key concepts:** mapped types, exhaustive mappings, indexed access, excess-property checking.

**Follow-ups:**

1. How would `Partial<Record<CvGuideline, string>>` differ?
2. What happens when a new member is added to `CvGuideline`?
3. When might a `Map` be more suitable than a `Record`?

### 5. What makes a discriminated union useful for input handling?

**Question:** How could this pair of fields be modeled more safely as a discriminated union?

```ts
type JobInputType = "text" | "url";

type JobInput =
  | { inputType: "text"; content: string }
  | { inputType: "url"; content: string };
```

**Expected answer:** The literal `inputType` discriminates the union. After checking `input.inputType`, TypeScript narrows the object to the matching member. This is especially useful when each mode later gains mode-specific fields, because invalid combinations can be made unrepresentable.

**Key concepts:** discriminated unions, control-flow narrowing, impossible states, exhaustive branches.

**Follow-ups:**

1. How would you add URL-only metadata to this union?
2. How can a `never` check enforce exhaustive handling?
3. Why must runtime request validation still exist?

**Practical exercise:** Refactor a function accepting `inputType` and `content` as separate arguments to accept one `JobInput` value and handle it exhaustively.

### 6. What does an `instanceof` check accomplish in a catch block?

**Question:** Explain the narrowing in this error mapper.

```ts
function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: "Something went wrong.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
```

**Expected answer:** Catch values can be anything, so `unknown` is the safe type. `instanceof AppError` performs a runtime prototype check and narrows the value, allowing access to `message`, `code`, and `status`. Unknown failures receive a generic response so internal details are not leaked.

**Key concepts:** catch-variable safety, class-based narrowing, error boundaries, safe error disclosure.

**Follow-ups:**

1. Why should the function not assume every thrown value is an `Error`?
2. When can `instanceof` be unreliable across JavaScript realms?
3. How could a custom type guard identify an error-shaped object?

### 7. What does `readonly` protect on a class property?

**Question:** What guarantee does `public readonly` provide here?

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

**Expected answer:** Parameter properties create and initialize the fields directly from constructor arguments. `readonly` prevents reassignment through TypeScript after construction, which keeps error classification stable. It is compile-time protection, not deep runtime immutability.

**Key concepts:** parameter properties, readonly fields, optional properties, compile-time immutability.

**Follow-ups:**

1. Can JavaScript code mutate these fields at runtime?
2. How is `readonly` different from `Object.freeze()`?
3. Why set `this.name` in a custom error class?

### 8. Why type lookup data with a union key?

**Question:** What mistake does this type prevent in the React component?

```ts
const guidelineDescriptions: Record<CvGuideline, string> = {
  jobMatch: "Compare the CV with a specific job post.",
  skills: "Assess the relevance and presentation of skills.",
  experience: "Review experience and measurable impact.",
  education: "Review education and qualifications.",
  clarity: "Assess structure and readability.",
  atsReadiness: "Check scanability and standard sections.",
};
```

**Expected answer:** The mapping cannot silently omit a valid guideline, and callers cannot index it with an arbitrary string. It connects UI copy to the same domain type used by schemas and API data.

**Key concepts:** domain modeling, keyed collections, compile-time completeness, shared contracts.

**Follow-ups:**

1. What would change if the key type were just `string`?
2. How would you represent optional descriptions?
3. Should display labels be part of the API response or client code?

### 9. Why use a type predicate or schema instead of casting a union response?

**Question:** Review this client-side response code.

```ts
type ApiResponse = { result: CvAnalysis; fileName: string };
type ApiError = { error?: string };

const payload = await readApiPayload(response);
if (!response.ok) {
  throw new Error((payload as ApiError).error ?? "CV analysis failed.");
}
setData(payload as ApiResponse);
```

What are the limitations of these assertions, and how could the code be made safer?

**Expected answer:** HTTP status helps select a branch, but TypeScript does not know that the payload shape matches the status. The assertions suppress checking and a successful response could still be malformed. A runtime schema, a discriminated response such as `{ ok: true, data } | { ok: false, error }`, or a carefully implemented type guard would provide stronger guarantees.

**Key concepts:** assertions, union narrowing, correlated data, discriminated API responses, client validation.

**Follow-ups:**

1. Does checking `Content-Type` prove the JSON shape is correct?
2. Where should response validation live?
3. What would a discriminated response contract look like?

**Practical exercise:** Define Zod schemas for the success and error responses and update `readApiPayload` to return a validated discriminated union.

### 10. How does TypeScript infer `Promise.all` results?

**Question:** What type and runtime behavior does this expression have?

```ts
const cvTextPromise = extractCvText(file);
const jobPromise: Promise<string | null> = needsJob
  ? resolveJobText()
  : Promise.resolve(null);

const [cvText, jobText] = await Promise.all([
  cvTextPromise,
  jobPromise,
]);
```

**Expected answer:** Modern TypeScript infers the array literal as a tuple in this context, so `cvText` is a `string` and `jobText` is `string | null`. At runtime both operations start before the `await` and run concurrently. `Promise.all` rejects as soon as either promise rejects, although the other operation is not automatically cancelled.

**Key concepts:** promise tuple inference, union types, concurrency, fail-fast behavior.

**Follow-ups:**

1. How would `Promise.allSettled` differ?
2. Does `Promise.all` cancel unfinished work?
3. When would sequential awaiting be necessary?

### 11. How does a nullable type improve domain accuracy?

**Question:** Why is `jobText` represented as `string | null` instead of an optional string or an empty string?

```ts
export async function analyzeCvWithOllama(
  cvText: string,
  guidelines: CvGuideline[],
  jobText: string | null,
) {
  // ...
}
```

**Expected answer:** `null` explicitly represents the valid state in which job matching was not requested. An empty string could ambiguously mean missing, invalid, or intentionally blank content. An optional parameter could imply the caller may forget it, whereas the required nullable argument forces every caller to make the state explicit.

**Key concepts:** nullability, domain states, required versus optional parameters, semantic clarity.

**Follow-ups:**

1. When would `undefined` be more appropriate?
2. How does strict null checking affect callers?
3. Could a discriminated input make the relationship with guidelines even stronger?

### 12. Why avoid `any` at a file-upload boundary?

**Question:** Explain why these checks are valuable even though the browser form contains a file input.

```ts
const file = formData.get("cv");

if (!(file instanceof File)) {
  throw new AppError("Upload a PDF or DOCX CV.", 400, "CV_FILE_REQUIRED");
}

const buffer = Buffer.from(await file.arrayBuffer());
```

**Expected answer:** `FormData.get()` may return a string, a `File`, or `null`. The `instanceof` check narrows that union to `File` before file-specific APIs are used. Treating the value as `any` or casting it would allow runtime failures and would trust a request that can be submitted outside the browser UI.

**Key concepts:** boundary validation, union narrowing, DOM types in Node, avoiding unchecked casts.

**Follow-ups:**

1. Why is client-side `accept=".pdf,.docx"` insufficient?
2. What additional file checks does the repository perform?
3. How would you test a string submitted under the `cv` field?

## Node.js — Questions 13–22

### 13. Why validate both a file extension and its binary signature?

**Question:** What protection do these checks provide?

```ts
function hasPdfSignature(buffer: Buffer) {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

if (extension === ".pdf" &&
    (!PDF_MIME_TYPES.has(file.type) || !hasPdfSignature(buffer))) {
  throw new AppError("This file is not a valid PDF.", 400, "INVALID_CV_FILE");
}
```

**Expected answer:** File names and client-provided MIME types can be incorrect or manipulated. Checking the magic bytes provides an additional indication that the content matches the claimed format. A signature check is not complete malware detection, but it prevents obvious renamed-file cases before the parser runs.

**Key concepts:** untrusted metadata, magic bytes, layered validation, parser safety.

**Follow-ups:**

1. Why is a signature check still not enough to prove a file is safe or well formed?
2. Why enforce a size limit before parsing?
3. What is the ZIP signature relevant to DOCX files?

### 14. Why dynamically import a server-side parser?

**Question:** Discuss the purpose of this dynamic import.

```ts
async function extractPdf(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}
```

**Expected answer:** The parser is loaded only when the PDF path is used, avoiding unnecessary initialization for DOCX requests. In this project it also keeps PDF-specific evaluation out of unrelated route initialization. The `finally` block releases parser resources whether extraction succeeds or throws.

**Key concepts:** dynamic imports, lazy loading, module evaluation, resource cleanup, `finally`.

**Follow-ups:**

1. Is a dynamically imported module downloaded on every call in Node.js?
2. What happens if `getText()` throws?
3. Why might a server package need to be externalized from a Next.js bundle?

### 15. How does bounded streaming protect memory?

**Question:** Why does the URL fetcher count streamed bytes rather than relying only on `Content-Length`?

```ts
const reader = response.body?.getReader();
const chunks: Uint8Array[] = [];
let size = 0;

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  size += value.byteLength;
  if (size > MAX_RESPONSE_BYTES) {
    await reader.cancel();
    throw new AppError("This page is too large.", 413, "PAGE_TOO_LARGE");
  }

  chunks.push(value);
}
```

**Expected answer:** `Content-Length` may be absent, wrong, or untrustworthy. Counting actual chunks enforces the limit on what is downloaded and retained. Cancelling the reader stops consuming the response after the limit is exceeded, reducing unnecessary network and memory use.

**Key concepts:** Web Streams in Node, backpressure, bounded input, denial-of-service protection.

**Follow-ups:**

1. What is the memory cost of collecting all chunks?
2. How could text be decoded incrementally?
3. Why check a declared `Content-Length` as an early optimization too?

**Practical exercise:** Modify the loop to use `TextDecoder` in streaming mode while preserving both byte and character limits.

### 16. What SSRF risk exists when a server fetches user-provided URLs?

**Question:** Why does the application resolve and inspect the target hostname before fetching it?

```ts
const addresses = isIP(hostname)
  ? [{ address: hostname }]
  : await dns.lookup(hostname, { all: true }).catch(() => []);

if (addresses.some(({ address }) => isPrivateAddress(address))) {
  throw new AppError(
    "Private-network URLs are not supported.",
    400,
    "PRIVATE_URL",
  );
}
```

**Expected answer:** Without validation, an attacker could make the server request loopback addresses, private services, cloud metadata endpoints, or other internal resources. Resolving all addresses and rejecting private ranges reduces server-side request forgery risk. Protocols, credentials, hostnames, redirects, time, size, and content type must also be constrained.

**Key concepts:** SSRF, DNS resolution, private networks, allowlists and denylists, defense in depth.

**Follow-ups:**

1. Why reject embedded URL credentials?
2. Which IPv4 ranges should be considered private or special?
3. What DNS rebinding limitation can remain between validation and connection?

### 17. Why manually follow and revalidate redirects?

**Question:** Why does the fetcher use `redirect: "manual"`?

```ts
const response = await fetch(url, { redirect: "manual" });

if (response.status >= 300 && response.status < 400) {
  const location = response.headers.get("location");
  const nextUrl = new URL(location!, url).toString();
  return fetchPage(await assertPublicUrl(nextUrl), redirects + 1);
}
```

**Expected answer:** A public URL can redirect to a private or otherwise forbidden target. Automatic redirect following would skip the application's validation of the new destination. Manual handling allows every location to be resolved, checked, and counted against a redirect limit.

**Key concepts:** redirect validation, SSRF bypasses, relative URLs, recursion limits.

**Follow-ups:**

1. Why pass the current URL as the base to `new URL()`?
2. What happens if `Location` is missing?
3. Why impose a maximum redirect count?

### 18. How should timeouts and abort signals be handled?

**Question:** Explain the timeout lifecycle in this pattern.

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60_000);

try {
  return await fetch(generateUrl, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

**Expected answer:** The timer aborts the request if it exceeds the deadline. Passing the signal allows `fetch` to observe cancellation. Clearing the timer in `finally` prevents an unnecessary timer from remaining active after success or failure. The catch path should distinguish an expected timeout from other connectivity failures and return a safe error.

**Key concepts:** `AbortController`, timers, cleanup, timeout classification, cancellation.

**Follow-ups:**

1. How does `AbortSignal.timeout()` simplify this pattern?
2. Is aborting guaranteed to stop all remote work?
3. How would you combine a caller-provided signal with a timeout?

### 19. When is `Promise.all` the right concurrency tool?

**Question:** Why does the route parse the CV and retrieve the job page concurrently?

```ts
const cvTextPromise = extractCvText(file);
const jobPromise = jobInputType === "url"
  ? extractTextFromUrl(jobContent).then((result) => result.text)
  : Promise.resolve(jobContent.trim());

const [cvText, jobText] = await Promise.all([cvTextPromise, jobPromise]);
```

**Expected answer:** The operations are independent, so running them concurrently reduces total latency to approximately the slower operation rather than the sum of both. `Promise.all` is appropriate because both results are required before analysis. If either fails, the route cannot continue.

**Key concepts:** asynchronous concurrency, dependencies, latency, fail-fast aggregation.

**Follow-ups:**

1. When would parallel execution be harmful?
2. What happens to the other operation after one rejects?
3. How could shared cancellation be added?

### 20. Why normalize extracted text before model processing?

**Question:** What purposes do normalization and post-extraction limits serve?

```ts
const normalized = text
  .replace(/\u0000/g, "")
  .replace(/\r\n?/g, "\n")
  .replace(/[ \t]+/g, " ")
  .trim();

if (normalized.length < 20) {
  throw new AppError("No readable CV text was found.", 422, "CV_TEXT_NOT_FOUND");
}
```

**Expected answer:** Parsers can produce null characters, mixed line endings, and noisy spacing. Normalization gives downstream logic predictable text and reduces irrelevant input. Minimum and maximum lengths classify empty/image-only documents and protect the model from oversized content even when the original file-size limit passed.

**Key concepts:** normalization, parser output, layered limits, downstream invariants.

**Follow-ups:**

1. Why preserve newlines instead of collapsing all whitespace?
2. Why have both file-byte and extracted-character limits?
3. What additional normalization might harm CV meaning?

### 21. How should expected and unexpected errors differ?

**Question:** Why does the route return details for `AppError` but use a generic response for unknown exceptions?

**Expected answer:** Expected operational failures have a deliberately safe message, stable code, and chosen HTTP status. Unexpected exceptions may contain stack traces, provider details, file paths, or secrets, so the client receives a generic error while the server can log a sanitized version. This produces a stable API without leaking implementation details.

**Key concepts:** operational errors, programmer errors, safe logging, stable error contracts, HTTP status codes.

**Follow-ups:**

1. Which failures should return 400, 413, 422, 502, or 503?
2. When is retry metadata useful?
3. What information should be redacted from server logs?

**Practical exercise:** Design a centralized error mapper that preserves `Retry-After` only for temporary failures.

### 22. Why constrain response types and downloaded content types?

**Question:** Why does the URL extractor reject non-HTML responses even if the server returns `200 OK`?

```ts
const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

if (!contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")) {
  throw new AppError(
    "Only HTML job pages are supported.",
    415,
    "UNSUPPORTED_CONTENT",
  );
}
```

**Expected answer:** HTTP success does not mean the body is suitable for the feature. Restricting content types keeps binary files and unsupported formats away from the HTML parser and makes resource usage and behavior more predictable. The body must still be size-bounded because headers are not fully trustworthy.

**Key concepts:** content negotiation, media types, parser selection, input constraints.

**Follow-ups:**

1. Why normalize the header to lowercase?
2. Can a malicious server lie about its content type?
3. What would be required to add PDF job-page support safely?

## React — Questions 23–26

### 23. Why store related input modes in one state object?

**Question:** Discuss the behavior of this state update.

```tsx
const [jobInputs, setJobInputs] = useState({ text: "", url: "" });

onChange={(event) =>
  setJobInputs((current) => ({
    ...current,
    text: event.target.value,
  }))
}
```

**Expected answer:** The component preserves separate values for text and URL modes, so switching modes does not discard what the user entered. The functional updater derives the next object from the latest state and avoids stale-state issues. Spreading preserves the field that is not being updated.

**Key concepts:** controlled inputs, functional state updates, immutable updates, UI state modeling.

**Follow-ups:**

1. When would two separate `useState` calls be clearer?
2. Why should state not be mutated directly?
3. What should happen to inactive input when the form is submitted?

### 24. Why derive state instead of storing it separately?

**Question:** Why are these values calculated during render?

```tsx
const needsJob = guidelines.includes("jobMatch");
const jobContent = jobInputs[jobInputType];
```

**Expected answer:** Both values are deterministic functions of existing state. Storing them in additional state would introduce synchronization work and the possibility of stale or contradictory values. The calculations are cheap, so memoization is unnecessary.

**Key concepts:** derived state, single source of truth, render calculations, unnecessary memoization.

**Follow-ups:**

1. When would `useMemo` be justified?
2. What bugs can duplicated state introduce?
3. How would the UI change when `jobMatch` is deselected?

### 25. Why use a functional update when toggling an array item?

**Question:** Explain this toggle implementation and its ordering behavior.

```tsx
function toggleGuideline(id: CvGuideline) {
  setGuidelines((current) =>
    current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id],
  );
}
```

**Expected answer:** The functional form receives the latest React state, which matters when updates are batched. Both branches return new arrays rather than mutating the existing state. Removed items lose their position, and reselecting an item appends it; that matters because this application expects criteria in the selected order.

**Key concepts:** batching, immutable arrays, functional updates, domain-significant ordering.

**Follow-ups:**

1. How would you preserve a canonical guideline order?
2. Why is using the array index as a rendered key undesirable here?
3. Could a `Set` simplify toggling, and what trade-offs would it introduce?

**Practical exercise:** Rewrite the toggle so selected guidelines always follow `cvGuidelineIds` order.

### 26. How should an asynchronous form submission manage UI state?

**Question:** What is important about the `try/catch/finally` structure below?

```tsx
setLoading(true);
setError("");

try {
  const response = await fetch("/api/analyze-cv", {
    method: "POST",
    body,
  });
  // validate and store response
} catch (caught) {
  setError(caught instanceof Error ? caught.message : "Analysis failed.");
} finally {
  setLoading(false);
}
```

**Expected answer:** Loading begins before the request and is cleared in `finally`, so success and failure both restore the UI. The error is cleared for a new attempt and unknown thrown values are safely narrowed. The submit button should be disabled while loading to reduce duplicate requests, and stale or overlapping responses may require cancellation for a more complex UI.

**Key concepts:** async UI states, cleanup, error narrowing, duplicate submission, race conditions.

**Follow-ups:**

1. How would you cancel a request when the component unmounts?
2. What race occurs if the user can submit twice quickly?
3. Why is client validation a usability feature rather than a security boundary?

## Next.js — Questions 27–30

### 27. What does the `"use client"` boundary mean?

**Question:** Why does `components/cv-analyzer.tsx` require this directive while its page can remain a Server Component?

```tsx
"use client";

import { useState } from "react";
```

**Expected answer:** The component uses state, event handlers, browser file inputs, scrolling, and other interactive browser behavior, so it must be a Client Component. The page can remain a Server Component for metadata and static composition. The directive establishes a client-module boundary; imported dependencies beneath it must be suitable for the browser.

**Key concepts:** React Server Components, Client Components, serialization boundary, browser APIs.

**Follow-ups:**

1. Can a Server Component render a Client Component?
2. Can a Client Component directly import a server-only module containing secrets?
3. What kinds of props can cross the server-to-client boundary?

### 28. Why explicitly select the Node.js runtime for a Route Handler?

**Question:** What does this export communicate?

```ts
export const runtime = "nodejs";
```

**Expected answer:** It tells Next.js that the route requires the Node.js runtime. This workflow uses Node-specific capabilities and packages such as DNS lookup, `Buffer`, PDF/DOCX parsers, and local Ollama networking. An edge-style runtime may not provide full Node API or native package compatibility.

**Key concepts:** Next.js runtimes, Node APIs, package compatibility, server-only execution.

**Follow-ups:**

1. Which modules in this project make Node.js necessary?
2. What advantages might an edge runtime offer for a compatible route?
3. How should server-only environment variables be accessed?

### 29. How does an App Router Route Handler validate multipart input?

**Question:** Describe the responsibilities of this handler before it calls application services.

```ts
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("cv");
  const guidelines = formData.get("guidelines");
  // validate, orchestrate services, and return NextResponse.json(...)
}
```

**Expected answer:** The Route Handler is the authoritative HTTP boundary. It checks request size, parses multipart data, validates field types and relationships, calls server-only services, and translates expected errors into the documented JSON contract. It must not rely on the React form because clients can call the endpoint directly.

**Key concepts:** Route Handlers, Web Request/FormData APIs, validation boundaries, orchestration, response contracts.

**Follow-ups:**

1. Why should the browser not manually set `Content-Type` for `FormData`?
2. Why check both declared request size and actual file size?
3. Which logic belongs in the route versus `lib/` modules?

**Practical exercise:** Sketch a route test for a missing file and another for duplicate guideline IDs.

### 30. How should safe API contracts be shared between server and client?

**Question:** The route returns either analysis data or a stable error. How would you keep that contract reliable across the Next.js client/server boundary?

```ts
type SuccessResponse = {
  result: CvAnalysis;
  fileName: string;
};

type ErrorResponse = {
  error: string;
  code: string;
  retryAfterSeconds?: number;
};
```

**Expected answer:** Shared types document the contract, but runtime schemas are required at untrusted boundaries. The server should validate inputs and provider output before responding; the client should handle malformed, non-JSON, success, and error responses without exposing internals. Stable codes support programmatic behavior, while messages remain safe for users. Secrets and raw provider errors must stay in server modules.

**Key concepts:** shared contracts, runtime validation, safe errors, server-only secrets, backward compatibility.

**Follow-ups:**

1. How could a discriminated `ok` field improve narrowing?
2. When should an API contract be versioned?
3. Why should provider-specific error details not be returned directly?

## Suggested Practice Approach

1. Answer each main question aloud in two to three minutes.
2. Explain the snippet before discussing improvements.
3. Attempt the practical exercises without copying the repository implementation.
4. Compare your answer with the expected points, then answer the follow-ups.
5. Revisit weak areas by tracing the complete flow in [CV Analyzer Technical Flow](technical-guide/CV_ANALYZER_FLOW.md).

## Related Project References

- [Senior TypeScript Key Concepts Interview Questions](typescript-key-concepts-interview-questions.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [CV Analyzer Technical Flow](technical-guide/CV_ANALYZER_FLOW.md)
- [`lib/schema.ts`](../lib/schema.ts)
- [`lib/cv-analyzer.ts`](../lib/cv-analyzer.ts)
- [`lib/cv-document.ts`](../lib/cv-document.ts)
- [`lib/url-content.ts`](../lib/url-content.ts)
- [`app/api/analyze-cv/route.ts`](../app/api/analyze-cv/route.ts)
- [`components/cv-analyzer.tsx`](../components/cv-analyzer.tsx)
