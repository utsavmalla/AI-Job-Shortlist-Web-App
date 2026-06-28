# Developer Guide

## Overview

Job Toolkit is a Next.js 15 App Router application using React 19 and strict TypeScript. It extracts structured requirements from job text or a public job URL and analyzes uploaded CVs against user-selected guidelines. Job extraction can use Gemini or Ollama; CV analysis always uses the configured local Ollama model. Inputs, files, and results are not persisted.

The application has no database, authentication, analytics, or file storage layer.

## Local development

Requirements:

- Node.js 20.16 or newer (required by the PDF parser).
- npm.
- Ollama with the configured model for CV analysis; a Gemini API key is needed only when job extraction uses Gemini.

Set up the project:

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

On macOS or Linux, replace the PowerShell copy command with:

```bash
cp .env.example .env.local
```

Environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | No | Job extraction provider: `gemini` (default) or `ollama`. CV analysis ignores this and always uses Ollama. |
| `OLLAMA_BASE_URL` | No | Ollama base URL; defaults to local `http://127.0.0.1:11434`. Use `https://ollama.com` for Ollama Cloud. |
| `OLLAMA_MODEL` | No | Ollama model; defaults to local `qwen3:8b`. Use a cloud model such as `gpt-oss:20b` with Ollama Cloud. |
| `OLLAMA_API_KEY` | For Ollama Cloud | Server-only bearer token for `https://ollama.com`; leave unset for local Ollama. |
| `GEMINI_API_KEY` | When using Gemini | Server-only credential used by the Gemini SDK. |
| `GEMINI_MODEL` | No | Overrides the default `gemini-2.5-flash-lite` model. |
| `EXTERNAL_REQUEST_DEBUG` | No | Set to `true` for detailed backend metadata logs for outbound job-page, Ollama, and Gemini requests. Prompts, CV text, job text, API keys, and provider response bodies are not logged. |

Never prefix these variables with `NEXT_PUBLIC_`. `.env.local` is ignored by Git; `.env.example` documents placeholders only.

For hosted deployments using Ollama Cloud, set:

```bash
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_API_KEY=your_ollama_api_key
```

## Architecture

### Project structure

```text
app/
  api/analyze-cv/route.ts POST multipart CV analysis endpoint
  api/extract/route.ts   POST endpoint and HTTP error mapping
  cv-analyzer/page.tsx   local CV analysis page
  layout.tsx             root metadata, fonts, and global styles
  page.tsx               renders the extraction workflow
components/
  cv-analyzer.tsx        upload, guideline selection, and report UI
  extractor.tsx          client state, submission, results, and JSON copy
lib/
  cv-analyzer.ts         Ollama CV prompt, structured output, and validation
  cv-document.ts         bounded PDF/DOCX text extraction
  errors.ts              safe typed application errors
  gemini.ts              prompt, model configuration, timeout, and validation
  schema.ts              request and structured-result contracts
  url-content.ts         public URL validation and bounded HTML extraction
tests/                   Vitest tests for routes, schemas, Gemini, and URL safety
```

The `@/*` TypeScript alias resolves from the repository root. The API route explicitly uses the Node.js runtime because URL validation depends on Node DNS and networking modules.

### Request and data flow

1. `components/extractor.tsx` sends `{ inputType, content }` to `POST /api/extract`.
2. `app/api/extract/route.ts` parses JSON and validates it with `extractRequestSchema`.
3. For URL input, `extractTextFromUrl` validates the target, follows at most three revalidated redirects, downloads bounded HTML, removes non-content elements, and extracts readable text.
4. `extractWithGemini` wraps the untrusted content in a defensive prompt and requests JSON matching the provider response schema.
5. The returned JSON is parsed and independently checked with `jobRequirementsSchema`.
6. The route returns the validated result and source metadata. The client renders the fields and can copy the result JSON.

For CV analysis, the client sends multipart form data to `POST /api/analyze-cv`. The server validates and extracts the uploaded PDF/DOCX, optionally retrieves a protected public job URL, and sends only the extracted text to Ollama. The strict `cvAnalysisSchema` is the authoritative output contract.

For a detailed walkthrough of the browser, parsing, URL retrieval, Ollama, validation, and error paths, see the [CV Analyzer technical flow](technical-guide/CV_ANALYZER_FLOW.md).

## API contract

### `POST /api/extract`

Text request:

```json
{
  "inputType": "text",
  "content": "Full job description"
}
```

URL request:

```json
{
  "inputType": "url",
  "content": "https://company.example/jobs/frontend-engineer"
}
```

Text is limited to 50,000 characters and URL input to 2,048 characters. Empty input is rejected.

Successful response:

```json
{
  "result": {
    "title": "Frontend Engineer",
    "company": "Example Company",
    "location": null,
    "remoteMode": "Remote",
    "employmentType": null,
    "requiredSkills": ["React", "TypeScript"],
    "preferredSkills": [],
    "minimumExperience": "3 years",
    "education": null,
    "responsibilities": ["Build accessible interfaces"],
    "salary": null,
    "applicationDeadline": null,
    "summary": "Build and maintain accessible web interfaces."
  },
  "source": {
    "type": "text",
    "url": null
  }
}
```

All result keys are required. Unknown keys are rejected. A missing scalar fact is `null`, while a missing list is `[]`; the model must not infer absent facts.

Error response:

```json
{
  "error": "Safe message for the user.",
  "code": "STABLE_ERROR_CODE",
  "retryAfterSeconds": 8
}
```

`retryAfterSeconds` and the HTTP `Retry-After` header are included only for temporary rate limits. Validation errors return `400`; retrieval, provider, configuration, and timeout failures use the status carried by `AppError`. Unexpected failures return `500` with `INTERNAL_ERROR` and a generic message.

### `POST /api/analyze-cv`

The endpoint accepts `multipart/form-data` with:

- `cv`: a PDF or DOCX file, maximum 5 MB;
- `guidelines`: a JSON array containing one or more of `jobMatch`, `skills`, `experience`, `education`, `clarity`, or `atsReadiness`;
- `jobInputType`: `text` or `url` when `jobMatch` is selected;
- `jobContent`: job text (50,000 characters maximum) or a public URL (2,048 characters maximum).

The response contains the original file name and a strict analysis result with an overall 0–100 score, one result per selected guideline, strengths, and priority actions. The server rejects duplicate/unknown guidelines and model responses that omit, add, or reorder criteria.

## Security and reliability invariants

### Secrets and provider isolation

- Gemini credentials are read only in `lib/gemini.ts`, which is reached through the server route.
- Raw provider errors are classified into safe `AppError` messages. Unknown provider errors are logged after API-key query parameters are redacted.
- Outbound requests always emit simple backend lifecycle logs. `EXTERNAL_REQUEST_DEBUG=true` adds sanitized metadata only; never log prompts, CV text, job text, credentials, or provider response bodies.
- Never send credentials, raw provider responses, internal prompts, or stack traces to the client.
- CV analysis never falls back to Gemini, even when `AI_PROVIDER=gemini`.
- Ollama Cloud credentials are sent only from server modules as an `Authorization` header when `OLLAMA_API_KEY` is configured.
- Uploaded CV bytes and extracted text are held only for the request and are not written to disk or persisted.

### Untrusted content and model output

- Pasted and fetched job content and extracted CV text are untrusted. Prompts explicitly delimit them and tell the model to ignore embedded instructions.
- Preserve these delimiters and the instruction to extract facts only. New model-powered features need an equivalent prompt-injection boundary.
- Gemini's response schema improves generation reliability, but Zod remains the authoritative runtime validation layer.
- Keep the provider schema and `jobRequirementsSchema` synchronized when fields change.

### URL retrieval and SSRF protection

`lib/url-content.ts` enforces the following controls:

- Only `http:` and `https:` URLs without embedded credentials are accepted.
- Localhost, `.local` names, and private, loopback, link-local, carrier-grade NAT, and private IPv4/IPv6 targets are rejected.
- DNS results are checked before fetching, and every redirect target is checked again.
- Fetch duration is limited to 8 seconds and redirects to 3.
- Downloaded content is limited to 1,500,000 bytes, including streamed responses without a trustworthy `Content-Length`.
- Only HTML/XHTML is accepted. Extracted text is limited to 50,000 characters.
- Login walls, JavaScript-only pages, and pages without enough readable content fail with guidance to paste the job description.

Do not replace manual redirects with automatic redirect following; doing so would bypass redirect-target validation. Any expansion of accepted hosts, protocols, or content types requires security tests.

### Timeouts and limits

Gemini requests time out after 20 seconds and Ollama requests after 60 seconds. CV files are limited to 5 MB and extracted CV/job text to 50,000 characters. PDF and DOCX names, MIME types, and file signatures are checked before parsing. Encrypted, malformed, image-only, empty, and oversized files return safe errors.

## Development conventions

- Keep TypeScript strict and prefer inferred types from Zod for shared data contracts.
- Use server modules for secrets, provider SDKs, DNS, and remote retrieval. Add `"use client"` only to components requiring browser state or APIs.
- Validate every external boundary: browser requests, fetched content, model output, and environment-dependent provider behavior.
- Use `AppError` for expected failures. Assign stable uppercase codes and user-safe messages; preserve `retryAfterSeconds` only when retrying is useful.
- Keep the current response contract backward compatible unless the task explicitly introduces an API change.
- Use accessible labels, roles, focus behavior, and disabled/loading states when changing the UI.
- Do not add persistence or analytics without updating the privacy statement and documenting data retention.

## Common change workflows

### Add or change an extracted field

1. Update `jobRequirementsSchema` and its inferred type in `lib/schema.ts`.
2. Update Gemini's `responseSchema`, required key list, and extraction instructions if needed.
3. Render the field in `components/extractor.tsx` and decide how `null` or an empty list appears.
4. Update schema, Gemini, route, and UI tests as applicable.
5. Update the API example in this guide.

Keep scalar absence represented by `null` and list absence by `[]` unless the API is intentionally versioned.

### Add a new input source

Treat the source as a new trust boundary. Extend the request schema, keep retrieval in a server-only module, impose explicit time and size limits, convert failures to safe `AppError` values, and add abuse-oriented tests before wiring it into the route and UI.

### Add or modify an error

Create or throw an `AppError` with a safe message, suitable HTTP status, and stable code. Add route or unit coverage for the status and response body. Never use retry metadata for permanent configuration or quota failures.

## Testing and verification

Run the complete local verification sequence:

```bash
npm run lint
npm test
npm run build
```

The Vitest suite currently covers:

- request and structured-output schema behavior;
- API validation and safe error mapping;
- Gemini model selection, malformed output, timeout, quota, rate-limit, and key errors;
- PDF/DOCX validation and extraction, CV request validation, local Ollama output, and CV UI behavior;
- rejection of private, credentialed, and unsupported URLs.

When changing UI behavior, add Testing Library coverage where practical and manually verify text and URL submissions, loading and error states, result rendering, copy-to-clipboard behavior, and keyboard/accessibility behavior.

## Troubleshooting

### `MISSING_API_KEY`

Create `.env.local` from `.env.example`, set `GEMINI_API_KEY`, and restart the development server. Do not paste the key into client code or commit the file.

### `INVALID_API_KEY` or `QUOTA_UNAVAILABLE`

Check the API key's Google AI Studio project, restrictions, model access, and available quota. `GEMINI_MODEL` can select another accessible model without a code change.

### `RATE_LIMITED` or `MODEL_BUSY`

Temporary rate limits may include retry guidance. Model-capacity errors should be retried later; they are distinct from unavailable project quota.

### URL extraction fails

Many job sites require authentication, block automated retrieval, or render content only with client-side JavaScript. The application deliberately does not bypass those controls. Paste the job description instead. For debugging, verify the URL is public HTML and does not redirect to a private or login-only target.

### CV analysis cannot connect

Start Ollama and ensure the configured model exists, for example `ollama pull qwen3:8b`. CV analysis is intentionally local-only and does not fall back to Gemini.

### CV text cannot be read

Use a text-based PDF or DOCX under 5 MB. Scanned/image-only PDFs require OCR before upload; encrypted, damaged, and legacy `.doc` files are not supported.

### Model output is rejected

Confirm the Gemini response schema and Zod schema have identical fields and nullability. Do not weaken strict validation to accept invented keys; adjust the prompt/provider schema and add a regression test.
