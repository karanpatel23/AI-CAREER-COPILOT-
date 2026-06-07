'use client';

import { type ChangeEvent, useMemo, useState } from 'react';
import UploadButton from '../../components/UploadButton';

type ApiResult = Record<string, unknown>;

type LoadingAction =
  | 'upload'
  | 'analyzeResume'
  | 'analyzeJob'
  | 'embedResume'
  | 'embedJob'
  | 'gaps'
  | 'tailor'
  | null;

async function readApiResponse(response: Response): Promise<ApiResult> {
  const text = await response.text();
  const data = text ? JSON.parse(text) as ApiResult : {};

  if (!response.ok) {
    const error = typeof data.error === 'string' ? data.error : 'Request failed';
    const action = typeof data.action === 'string' ? ` ${data.action}` : '';
    throw new Error(`${error}${action}`);
  }

  return data;
}

async function postJson(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return readApiResponse(response);
}

function getNestedString(value: unknown, path: string[]): string {
  let current = value;

  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return '';
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : '';
}

export default function ResumeUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [userId, setUserId] = useState('00000000-0000-0000-0000-000000000000');
  const [resumeId, setResumeId] = useState('');
  const [jobId, setJobId] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tailorMode, setTailorMode] = useState('ats_optimized');
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [gapSummary, setGapSummary] = useState('');
  const [tailoredMarkdown, setTailoredMarkdown] = useState('');

  const loading = loadingAction !== null;
  const canAnalyzeResume = useMemo(() => Boolean(resumeId.trim()), [resumeId]);
  const canUseJob = useMemo(() => Boolean(jobId.trim()), [jobId]);

  const runAction = async (action: Exclude<LoadingAction, null>, task: () => Promise<void>) => {
    setLoadingAction(action);
    setError('');
    setMessage('');

    try {
      await task();
    } catch (unknownError: unknown) {
      setError(unknownError instanceof Error ? unknownError.message : 'Something went wrong.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file.');
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return;
    }

    if (!userId.trim()) {
      setError('Please enter a Supabase user UUID.');
      return;
    }

    await runAction('upload', async () => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId.trim());

      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await readApiResponse(response);
      const id = getNestedString(data.resume, ['id']);

      setResumeId(id);
      setFile(null);
      setMessage('Resume uploaded successfully. Next, analyze the resume.');
    });
  };

  const analyzeResume = async () => {
    await runAction('analyzeResume', async () => {
      await postJson('/api/resume/analyze', { resumeId });
      setMessage('Resume analysis completed.');
    });
  };

  const analyzeJob = async () => {
    if (jobDescription.trim().length < 80) {
      setError('Paste a fuller job description before analyzing.');
      return;
    }

    await runAction('analyzeJob', async () => {
      const data = await postJson('/api/job/analyze', { raw_text: jobDescription });
      const id = getNestedString(data.job, ['id']);
      setJobId(id);
      setMessage('Job analysis completed.');
    });
  };

  const embedResume = async () => {
    await runAction('embedResume', async () => {
      await postJson('/api/resume/embedding', { resumeId });
      setMessage('Resume embedding generated.');
    });
  };

  const embedJob = async () => {
    await runAction('embedJob', async () => {
      await postJson('/api/job/embedding', { jobId });
      setMessage('Job embedding generated.');
    });
  };

  const analyzeGaps = async () => {
    await runAction('gaps', async () => {
      const data = await postJson('/api/resume/gaps', { resumeId, jobId });
      const score = typeof data.fitScore === 'number' ? Math.round(data.fitScore * 100) : null;
      setGapSummary(score !== null ? `Fit score: ${score}%` : 'Gap analysis completed.');
      setMessage('Gap analysis completed.');
    });
  };

  const tailorResume = async () => {
    await runAction('tailor', async () => {
      const data = await postJson('/api/resume/tailor', { resumeId, jobId, mode: tailorMode });
      const markdown = getNestedString(data.tailoredResume, ['markdown']);
      setTailoredMarkdown(markdown);
      setMessage('Tailored resume generated.');
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">AI Career Copilot</h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Upload a resume, analyze a job description, run gap analysis, then generate a clean tailored resume.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">1. Resume</h2>

          <label className="mb-2 block text-sm font-medium" htmlFor="user-id">
            Supabase User UUID
          </label>
          <input
            id="user-id"
            type="text"
            value={userId}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setUserId(event.target.value)}
            placeholder="Paste auth.users.id or use demo UUID locally"
            className="w-full rounded-md border px-3 py-2 text-sm"
            disabled={loading}
          />
          <p className="mb-4 mt-1 text-xs text-zinc-500">
            Local demo default is allowed outside production. In production, use the signed-in Supabase user ID.
          </p>

          <input
            type="file"
            accept="application/pdf"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)}
            className="mb-4 w-full text-sm"
            disabled={loading}
          />

          <UploadButton onClick={handleUpload} loading={loadingAction === 'upload'} disabled={loading} />

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium" htmlFor="resume-id">
              Resume ID
            </label>
            <input
              id="resume-id"
              type="text"
              value={resumeId}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setResumeId(event.target.value)}
              placeholder="Resume ID appears here after upload"
              className="w-full rounded-md border px-3 py-2 text-sm"
              disabled={loading}
            />

            <button
              onClick={analyzeResume}
              disabled={loading || !canAnalyzeResume}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              {loadingAction === 'analyzeResume' ? 'Analyzing...' : 'Analyze Resume'}
            </button>
            <button
              onClick={embedResume}
              disabled={loading || !canAnalyzeResume}
              className="ml-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              {loadingAction === 'embedResume' ? 'Embedding...' : 'Generate Resume Embedding'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">2. Job Description</h2>
          <textarea
            value={jobDescription}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setJobDescription(event.target.value)}
            placeholder="Paste the full job description here..."
            className="mb-4 h-52 w-full rounded-md border px-3 py-2 text-sm"
            disabled={loading}
          />

          <button
            onClick={analyzeJob}
            disabled={loading || jobDescription.trim().length < 80}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingAction === 'analyzeJob' ? 'Analyzing...' : 'Analyze Job'}
          </button>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium" htmlFor="job-id">
              Job ID
            </label>
            <input
              id="job-id"
              type="text"
              value={jobId}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setJobId(event.target.value)}
              placeholder="Job ID appears here after analysis"
              className="w-full rounded-md border px-3 py-2 text-sm"
              disabled={loading}
            />

            <button
              onClick={embedJob}
              disabled={loading || !canUseJob}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              {loadingAction === 'embedJob' ? 'Embedding...' : 'Generate Job Embedding'}
            </button>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">3. Gap Analysis & Tailoring</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={analyzeGaps}
            disabled={loading || !canAnalyzeResume || !canUseJob}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
          >
            {loadingAction === 'gaps' ? 'Analyzing gaps...' : 'Run Gap Analysis'}
          </button>

          <select
            value={tailorMode}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setTailorMode(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
            disabled={loading}
          >
            <option value="ats_optimized">ATS optimized</option>
            <option value="concise">Concise</option>
            <option value="impact">Impact focused</option>
          </select>

          <button
            onClick={tailorResume}
            disabled={loading || !canAnalyzeResume || !canUseJob}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loadingAction === 'tailor' ? 'Tailoring...' : 'Tailor Resume'}
          </button>
        </div>

        {gapSummary && <p className="mt-4 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">{gapSummary}</p>}
        {message && <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      {tailoredMarkdown && (
        <section className="mt-6 rounded-xl border p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Tailored Resume Output</h2>
          <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-sm leading-6 text-zinc-50">
            {tailoredMarkdown}
          </pre>
        </section>
      )}
    </main>
  );
}
