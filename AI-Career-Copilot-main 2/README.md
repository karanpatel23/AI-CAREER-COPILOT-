# AI Career Copilot

AI Career Copilot is a Next.js + Supabase + Azure OpenAI application that helps candidates analyze a resume against a target job, identify gaps, and generate a clean tailored resume while staying truthful to the original resume.

## What it does

- Uploads and parses text-readable PDF resumes
- Extracts structured resume facts: summary, roles, skills, education, certifications, achievements, work experience, and projects
- Extracts structured job requirements: must-have skills, preferred skills, tools, responsibilities, keywords, seniority, tone, and domain
- Computes a relevance score using weighted requirement matching, experience fit, seniority fit, and optional semantic embeddings
- Generates actionable resume feedback without inventing unsupported qualifications
- Produces a polished tailored resume response with structured JSON and render-ready markdown
- Supports section-level rewrites and resume/job fit chat

## Backend pipeline

```text
1. POST /api/resume/upload
   PDF file + user_id
   -> parse PDF
   -> validate extracted text
   -> save raw resume text

2. POST /api/resume/analyze
   resumeId
   -> extract structured resume analysis through Azure OpenAI
   -> save analysis JSONB

3. POST /api/job/analyze
   raw_text
   -> extract structured job requirements through Azure OpenAI
   -> save job + analysis JSONB

4. POST /api/resume/embedding and POST /api/job/embedding
   -> build compact signal text from analysis when available
   -> generate Azure OpenAI embeddings
   -> save vectors

5. POST /api/resume/gaps
   resumeId + jobId
   -> compare must-have skills, preferred skills, keywords, years, and seniority
   -> generate fit score + component scores + improvement suggestions
   -> upsert gap row

6. POST /api/resume/tailor
   resumeId + jobId + mode
   -> reuse persisted gaps when available, otherwise compute fallback gaps
   -> generate one structured tailored resume in a single AI call
   -> return JSON sections + markdown
```

## API endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/resume/upload` | Upload and parse a PDF resume |
| `POST /api/resume/analyze` | Extract structured resume data |
| `POST /api/job/analyze` | Extract structured job requirements |
| `POST /api/resume/embedding` | Generate resume embedding from compact signal text |
| `POST /api/job/embedding` | Generate job embedding from compact signal text |
| `POST /api/resume/gaps` | Compute fit score, gaps, component scores, and suggestions |
| `POST /api/resume/tailor` | Generate a tailored resume in ATS, concise, or impact mode |
| `POST /api/resume/rewrite-section` | Rewrite a specific section with a selected mode |
| `POST /api/chat/edit-section` | Edit a section using full resume/job context |
| `POST /api/chat/resume` | Ask questions about resume-job fit |
| `POST /api/match/resume-to-jobs` | Rank stored jobs for a resume |

## Scoring model

The matching system uses a layered score instead of shallow keyword overlap:

- Must-have skill coverage: highest weight
- Preferred skill coverage: secondary weight
- Job keyword/tool coverage: supporting signal
- Experience years fit
- Seniority fit
- Optional semantic embedding score when both vectors are available

The gap endpoint returns both a final `fitScore` and `componentScores` so the UI can explain why a candidate is strong or weak for a role.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_DEPLOYMENT=your-chat-deployment-name
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=your-embedding-deployment-name
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

4. Run the schema in Supabase:

```sql
-- See supabase/schema.sql
```

5. Start the app:

```bash
npm run dev
```

6. Validate locally:

```bash
npm run typecheck
npm run lint
npm run check
```

## UI workflow

Open `/resume` after starting the dev server. The page now supports the full core workflow:

1. Upload resume
2. Analyze resume
3. Paste and analyze job description
4. Generate embeddings if semantic matching is needed
5. Run gap analysis
6. Generate tailored resume markdown

## Production notes

- Use Supabase Auth instead of manually entering `user_id` in a production UI.
- Keep the service role key server-side only.
- Use text-readable PDFs. Scanned resumes need OCR before this pipeline.
- Tune Azure OpenAI deployment names and API version for your Azure resource.
- Embedding vector dimensions in `supabase/schema.sql` assume a 1536-dimensional embedding model. Adjust the vector size if your embedding deployment uses a different dimension.

### Demo user UUID during local development

The upload page pre-fills `00000000-0000-0000-0000-000000000000` so you can test the flow locally without wiring Supabase Auth first. The backend allows this value only outside production by default. In production, paste the real signed-in user ID from `auth.users.id`, or set `ALLOW_DEMO_USER_ID=true` only for a controlled demo environment.
