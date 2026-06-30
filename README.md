# Job Requirements Extractor

A small Next.js app that turns pasted job descriptions or public job-page URLs into structured requirements using local Ollama or Gemini.

Contributor setup, architecture, API contracts, security constraints, and development workflows are documented in the [Developer Guide](docs/DEVELOPER_GUIDE.md). Docker Hub and Render deployment steps are documented in the [Deployment Guide](docs/DEPLOYMENT.md).

## Run locally

1. Install dependencies with `npm install`.
2. Install and start Ollama, then download the local model with `ollama pull qwen3:8b`.
3. Copy `.env.example` to `.env.local`. Keep `AI_PROVIDER=ollama` for local extraction, or change it to `gemini` and set `GEMINI_API_KEY`.
4. Run `npm run dev` and open `http://localhost:3000`.

Provider configuration and API keys are read only on the server and are never included in browser code. Submitted content and results are not persisted. Ollama failures are reported locally and do not fall back to Gemini.

## Deploy

The app includes a standalone Next.js Dockerfile. Build and publish the image to Docker Hub, then run it on Render with Ollama Cloud environment variables. See the [Deployment Guide](docs/DEPLOYMENT.md) for exact commands and Render settings.

## API

`POST /api/extract`

```json
{ "inputType": "text", "content": "...job description..." }
```

URL retrieval accepts only public HTTP(S) HTML pages, checks DNS and redirects against private-network targets, limits response time and size, and does not bypass logins or bot protection.
