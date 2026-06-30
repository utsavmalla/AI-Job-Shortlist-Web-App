# Deployment Guide

This app can be deployed as a Docker image published to Docker Hub, then run on a cloud container platform such as Render. Docker Hub stores the image; Render runs it as a web service.

## Prerequisites

- Docker Desktop or Docker Engine.
- A Docker Hub account and repository, for example `yourname/job-requirements-extractor`.
- An Ollama Cloud API key for hosted CV analysis and Ollama-backed extraction.

Do not commit real API keys or `.env.local`. Configure secrets in Docker, Render, or your local shell.

## Build and Test the Image Locally

From the repository root:

```bash
docker build -t job-requirements-extractor:local .
```

Run the image with local environment values:

```bash
docker run --rm -p 3000:3000 --env-file .env.local job-requirements-extractor:local
```

Open `http://localhost:3000` and confirm the app loads.

For a hosted-style local smoke test, use Ollama Cloud values in `.env.local`:

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_API_KEY=your_ollama_api_key
```

Do not enable `EXTERNAL_REQUEST_PROMPT_DEBUG` outside local debugging because it logs raw job and CV text inside prompts.

## Publish to Docker Hub

Log in to Docker Hub:

```bash
docker login
```

Build the publishable image:

```bash
docker build -t <dockerhub-username>/job-requirements-extractor:latest .
```

Push it:

```bash
docker push <dockerhub-username>/job-requirements-extractor:latest
```

Use version tags for repeatable releases when needed:

```bash
docker tag <dockerhub-username>/job-requirements-extractor:latest <dockerhub-username>/job-requirements-extractor:v1
docker push <dockerhub-username>/job-requirements-extractor:v1
```

## Deploy on Render

Create a new Render service:

- Service type: Web Service.
- Source/runtime: Docker image.
- Docker image: `<dockerhub-username>/job-requirements-extractor:latest`.
- Port: `3000`.
- Health check path: `/`.

Set these Render environment variables:

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=gpt-oss:20b
OLLAMA_API_KEY=<Render secret>
```

Optional sanitized request metadata logging:

```bash
EXTERNAL_REQUEST_DEBUG=true
```

Leave `EXTERNAL_REQUEST_PROMPT_DEBUG` unset in Render. It logs complete model prompts, including raw pasted/fetched job text and uploaded CV text.

## Hosted Smoke Test

After Render deploys the image:

1. Open the Render service URL and confirm `/` loads.
2. Submit a pasted job description and confirm extraction succeeds.
3. Upload a small PDF or DOCX CV with selected guidelines and confirm CV analysis succeeds.
4. Check Render logs for safe lifecycle logs. Raw prompts should not appear unless `EXTERNAL_REQUEST_PROMPT_DEBUG=true` was explicitly set.

If Render cannot reach the model provider, verify `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `OLLAMA_API_KEY`. The app reads these values only on the server.
