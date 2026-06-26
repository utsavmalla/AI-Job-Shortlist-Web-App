# Docker Deployment

This project can be built as a standalone Next.js container image. The image runs the web app only; Ollama must be reachable from the container through `OLLAMA_BASE_URL`.

## Build

```bash
docker build -t job-requirements-extractor .
```

## Environment

Create a local production env file that is not committed, for example `.env.production`:

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen3:8b

# Optional for Gemini-backed job extraction.
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite
```

Use server-only variable names. Do not prefix secrets with `NEXT_PUBLIC_`.

For Ollama Cloud instead of a local host service, use deployment secrets:

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_API_KEY=your_ollama_api_key
```

## Run

```bash
docker run --rm --env-file .env.production -p 3000:3000 job-requirements-extractor
```

Open `http://localhost:3000`.

## Ollama requirement

CV analysis always uses Ollama. Job extraction also uses Ollama when `AI_PROVIDER=ollama`. In Docker, `127.0.0.1` means the app container itself, so `OLLAMA_BASE_URL` must point to an Ollama service reachable from inside the container.

Common examples:

```bash
# Docker Desktop, Ollama running on the host machine
OLLAMA_BASE_URL=http://host.docker.internal:11434

# A managed or private network Ollama service
OLLAMA_BASE_URL=http://ollama.example.internal:11434

# Ollama Cloud
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_API_KEY=your_ollama_api_key
```

If you set `AI_PROVIDER=gemini`, job extraction can use Gemini, but CV analysis still requires Ollama.

## Verification

Before publishing the image, run:

```bash
npm run lint
npm test
npm run build
docker build -t job-requirements-extractor .
```

Then start the container and smoke-test:

- `http://localhost:3000`
- `http://localhost:3000/cv-analyzer`
- Ollama-backed extraction and CV analysis, if the configured endpoint is available
