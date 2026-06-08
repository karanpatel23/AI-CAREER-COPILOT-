# AGENTS.md

## Project overview
AI Career Copilot is a production-oriented resume and job matching platform built with Next.js, Supabase, and Azure OpenAI. It helps users upload resumes, analyze resume/job fit, generate truthful tailored resumes, and chat with an AI assistant about resume and job matching results.

## Critical product flow
The following flow is core product behavior and must never be broken, removed, bypassed, or replaced with mock-only behavior:

1. Resume upload
2. Resume text extraction
3. Resume analysis
4. Job description analysis
5. Resume and job embeddings
6. Gap analysis
7. Tailored resume generation
8. AI resume/job chatbot

## Non-negotiable product rules
- Do not remove existing features.
- Do not delete, disconnect, hide, or regress the AI resume/job chatbot.
- Do not replace real backend logic, Supabase calls, Azure OpenAI calls, resume parsing, embedding generation, or analysis flows with mock data.
- Do not return raw AI JSON directly to the frontend; parse, validate, normalize, and return clean API responses.
- Preserve truthful resume information.
- Do not hallucinate fake companies, fake skills, fake roles, fake education, fake certifications, fake dates, fake metrics, or fake achievements.
- Tailored resume generation may improve wording and emphasize relevant truthful experience, but it must not invent user history.
- Keep API responses clean, consistent, typed when possible, and safe for frontend consumption.
- Validate all user inputs before calling AI APIs, Supabase, or other backend services.
- Keep frontend loading, error, empty, and success states clear and user-friendly.

## Engineering expectations
- Make the smallest practical change needed for the task.
- Avoid unnecessary edits to unrelated files.
- Preserve existing product behavior unless the task explicitly requires changing it.
- Keep Next.js route handlers, server actions, and client components clearly separated by responsibility.
- Prefer typed request/response shapes and shared validation utilities over ad hoc object handling.
- Handle Azure OpenAI and Supabase errors gracefully; never expose secrets or raw provider errors to users.
- Keep environment variables server-side unless they are intentionally public and prefixed appropriately for Next.js.
- Never commit secrets, API keys, tokens, `.env` files, generated build output, or dependency folders such as `node_modules`.

## AI and resume safety rules
- Always treat AI output as untrusted until parsed and validated.
- Ask AI models for structured output only when the backend can parse and validate the structure before returning it.
- If model output is invalid, return a clear application-level error or retry with guardrails rather than passing invalid content through.
- Gap analysis should distinguish between confirmed user experience, missing requirements, and suggested learning areas.
- Chatbot responses must stay grounded in the provided resume, job description, and analysis context.

## Required checks before completing code changes
Run these checks from the application directory that contains `package.json`:

```bash
npm run typecheck
npm run lint
npm run build
```

If a check cannot be run because of an environment limitation, document the exact command and limitation in the final response.

## Pull request expectations
- Summarize what changed and why.
- Mention that the core resume/job matching flow and chatbot were not intentionally changed when applicable.
- Include the results of required checks.
