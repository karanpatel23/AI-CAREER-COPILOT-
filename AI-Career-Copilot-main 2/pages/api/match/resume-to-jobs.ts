/**
 * POST /api/match/resume-to-jobs
 * Matches one resume against available jobs using semantic embeddings and structured relevance scoring.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getRequiredUuid, handleApiError } from '../../../lib/api/http';
import { analyzeResumeGaps } from '../../../lib/ai/resumeGapAnalysis';
import { normalizeJobAnalysis, normalizeResumeAnalysis } from '../../../lib/resumeFormatters';
import { supabaseAdmin } from '../../../lib/supabaseClient';

type JobRow = {
  id: string;
  title: string | null;
  analysis: unknown;
  embedding: unknown;
};

type MatchResult = {
  jobId: string;
  title: string;
  fitScore: number;
  semanticScore: number;
  analysisScore: number;
  skillScore: number;
  experienceScore: number;
  seniorityScore: number;
  matchedSkills: string[];
  missingSkills: string[];
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function normalizeEmbedding(embedding: unknown): number[] | null {
  if (!embedding) return null;

  if (Array.isArray(embedding)) {
    return embedding.every(value => typeof value === 'number' && Number.isFinite(value))
      ? embedding
      : null;
  }

  if (typeof embedding === 'string') {
    const normalized = embedding.trim();

    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return parsed.every(value => typeof value === 'number' && Number.isFinite(value))
          ? parsed
          : null;
      }
    } catch {
      // pgvector can serialize as comma-separated bracketed text.
    }

    const vectorText = normalized.replace(/^\[/, '').replace(/\]$/, '').replace(/^\(/, '').replace(/\)$/, '');
    const parsed = vectorText
      .split(',')
      .map(value => Number(value.trim()))
      .filter(value => Number.isFinite(value));

    return parsed.length > 0 ? parsed : null;
  }

  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (!magnitudeA || !magnitudeB) return 0;
  return clampScore(dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB)));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const resumeId = getRequiredUuid(req.body, 'resumeId');

    const { data: resume, error: resumeError } = await supabaseAdmin
      .from('resumes')
      .select('id, analysis, embedding')
      .eq('id', resumeId)
      .single();

    if (resumeError || !resume) {
      throw new ApiError(404, 'Resume not found.', 'RESUME_NOT_FOUND');
    }

    if (!resume.analysis) {
      throw new ApiError(409, 'Resume has not been analyzed yet.', 'RESUME_ANALYSIS_MISSING', undefined, 'Run /api/resume/analyze before matching.');
    }

    const resumeAnalysis = normalizeResumeAnalysis(resume.analysis);
    const resumeEmbedding = normalizeEmbedding(resume.embedding);

    const { data: jobs, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, title, analysis, embedding');

    if (jobError) {
      throw new ApiError(500, 'Failed to fetch jobs.', 'DATABASE_ERROR', jobError.message);
    }

    const jobRows = ((jobs || []) as JobRow[]).filter(job => job.analysis);

    const results: MatchResult[] = jobRows
      .map((job: JobRow): MatchResult => {
        const jobEmbedding = normalizeEmbedding(job.embedding);
        const jobAnalysis = normalizeJobAnalysis(job.analysis);
        const semanticScore = resumeEmbedding && jobEmbedding ? cosineSimilarity(resumeEmbedding, jobEmbedding) : 0;
        const gaps = analyzeResumeGaps(resumeAnalysis, jobAnalysis);
        const analysisScore = gaps.fitScore;
        const fitScore = resumeEmbedding && jobEmbedding
          ? clampScore(semanticScore * 0.35 + analysisScore * 0.65)
          : analysisScore;

        return {
          jobId: job.id,
          title: typeof job.title === 'string' && job.title ? job.title : jobAnalysis.title,
          fitScore,
          semanticScore,
          analysisScore,
          skillScore: gaps.componentScores.skillScore,
          experienceScore: gaps.componentScores.experienceScore,
          seniorityScore: gaps.componentScores.seniorityScore,
          matchedSkills: gaps.matchedSkills,
          missingSkills: gaps.missingSkills,
        };
      })
      .sort((a: MatchResult, b: MatchResult) => b.fitScore - a.fitScore);

    return res.status(200).json({
      success: true,
      resumeId,
      count: results.length,
      note: resumeEmbedding ? undefined : 'Resume embedding is missing, so matches used structured analysis scoring only. Run /api/resume/embedding for semantic scoring.',
      matches: results,
    });
  } catch (error) {
    return handleApiError(res, error, 'Resume-to-jobs matching failed');
  }
}
