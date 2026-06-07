/**
 * POST /api/chat/resume
 * Conversational Q&A about resume-job fit using full context.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getRequiredString, getRequiredUuid, handleApiError } from '../../../lib/api/http';
import { resumeAwareChat } from '../../../lib/ai/resumeChat';
import { analyzeResumeGaps } from '../../../lib/ai/resumeGapAnalysis';
import { buildResumeChatContext, normalizeJobAnalysis, normalizeResumeAnalysis } from '../../../lib/resumeFormatters';
import { LIMITS } from '../../../lib/text';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const resumeId = getRequiredUuid(req.body, 'resumeId');
    const jobId = getRequiredUuid(req.body, 'jobId');
    const question = getRequiredString(req.body, 'question', LIMITS.maxUserInstructionChars);

    const [{ data: resume, error: resumeError }, { data: job, error: jobError }] = await Promise.all([
      supabaseAdmin.from('resumes').select('analysis').eq('id', resumeId).single(),
      supabaseAdmin.from('jobs').select('analysis').eq('id', jobId).single(),
    ]);

    if (resumeError || !resume) {
      throw new ApiError(404, 'Resume not found.', 'RESUME_NOT_FOUND');
    }

    if (jobError || !job) {
      throw new ApiError(404, 'Job not found.', 'JOB_NOT_FOUND');
    }

    if (!resume.analysis || !job.analysis) {
      throw new ApiError(409, 'Resume and job must both be analyzed before chat.', 'ANALYSIS_MISSING');
    }

    const { data: gapData } = await supabaseAdmin
      .from('resume_job_gaps')
      .select('missing_skills, fit_score')
      .eq('resume_id', resumeId)
      .eq('job_id', jobId)
      .maybeSingle();

    const fallbackGaps = analyzeResumeGaps(normalizeResumeAnalysis(resume.analysis), normalizeJobAnalysis(job.analysis));
    const context = buildResumeChatContext(resume.analysis, job.analysis, {
      missing_skills: Array.isArray(gapData?.missing_skills) ? gapData.missing_skills : fallbackGaps.missingSkills,
      fit_score: typeof gapData?.fit_score === 'number' ? gapData.fit_score : fallbackGaps.fitScore,
    });
    const answer = await resumeAwareChat(context, question);

    return res.status(200).json({
      success: true,
      resumeId,
      jobId,
      answer,
      usedPersistedGapAnalysis: Boolean(gapData),
    });
  } catch (error) {
    return handleApiError(res, error, 'Resume chat failed');
  }
}
