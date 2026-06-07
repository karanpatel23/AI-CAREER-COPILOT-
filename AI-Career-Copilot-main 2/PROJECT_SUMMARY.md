# Project Summary — Production Readiness Pass

This project is an AI-powered resume analysis, matching, and tailoring system built with Next.js API routes, Supabase, and Azure OpenAI.

## Current architecture

```text
app/                  Minimal workflow UI
components/           Shared UI components
pages/api/            Backend API routes
lib/api/              Request validation and error handling helpers
lib/ai/               Azure OpenAI extraction, chat, scoring, tailoring, and embeddings
lib/types/            Stored JSONB contracts for resume and job analysis
lib/                  Supabase, PDF parser, text utilities, normalizers, match helpers
supabase/             Baseline database schema
```

## Backend pipeline

1. Resume upload parses a PDF, validates extracted text, and stores `raw_text`.
2. Resume analysis extracts factual structured data from the resume.
3. Job analysis extracts must-have skills, preferred skills, tools, responsibilities, seniority, tone, and domain.
4. Embedding routes build compact signal text from analysis where possible, reducing token usage and improving semantic quality.
5. Gap analysis computes weighted relevance using must-have coverage, preferred coverage, keyword/tool coverage, experience fit, and seniority fit.
6. Resume tailoring generates one clean structured tailored resume response in a single model call, returning both sections and markdown.
7. Chat and section editing use fallback gap computation when a persisted gap row is missing.

## Second-pass improvements completed

- Rewrote all AI prompts with strict schemas, truthfulness rules, role-specific extraction guidance, and cleaner output instructions.
- Expanded resume analysis to include certifications, keywords, and achievements.
- Expanded job analysis to include must-have skills, preferred skills, tools, keywords, tone, and domain.
- Replaced shallow keyword-only scoring with weighted structured relevance scoring.
- Added component scores so the product can explain why a fit score is high or low.
- Added token-safe text normalization and truncation before AI/embedding calls.
- Converted full-resume tailoring from many sequential AI calls into one structured model call for speed, consistency, and cleaner output.
- Added markdown rendering for tailored resumes so frontend users receive paste-ready content.
- Hardened API validation with UUID checks, length checks, actionable error messages, and consistent `success` response fields.
- Improved graceful degradation: chat/edit/tailor can compute fallback gaps if persisted gaps are missing.
- Improved embeddings by embedding compact resume/job signals instead of blindly embedding full raw text.
- Built a fuller `/resume` workflow UI with loading states, error states, resume analysis, job analysis, embeddings, gap analysis, and tailoring.
- Removed debug/TODO style loose ends from the active code.

## Validation

A TypeScript syntax/type pass was run with temporary local stubs because package installation was unavailable in the sandbox. The remaining full local validation should be run after installing dependencies:

```bash
npm install
npm run typecheck
npm run lint
npm run dev
```
