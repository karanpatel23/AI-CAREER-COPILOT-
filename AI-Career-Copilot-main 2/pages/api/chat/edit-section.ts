/**
 * POST /api/chat/edit-section
 * Edits a specific resume section using resume-aware AI.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getRequiredString, getRequiredUuid, handleApiError } from '../../../lib/api/http';
import { editResumeSection, isResumeSection } from '../../../lib/ai/resumeSectionEditor';
import { analyzeResumeGaps } from '../../../lib/ai/resumeGapAnalysis';
import { buildResumeChatContext, normalizeJobAnalysis, normalizeResumeAnalysis } from '../../../lib/resumeFormatters';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const resumeId = getRequiredUuid(req.body, 'resumeId');
    const jobId = getRequiredUuid(req.body, 'jobId');
    const section = getRequiredString(req.body, 'section');

    if (!isResumeSection(section)) {
      throw new ApiError(400, 'section must be one of: summary, skills, experience, education, projects.', 'VALIDATION_ERROR');
    }

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
      throw new ApiError(409, 'Resume and job must both be analyzed before editing.', 'ANALYSIS_MISSING');
    }

    const { data: gap } = await supabaseAdmin
      .from('resume_job_gaps')
      .select('missing_skills, fit_score')
      .eq('resume_id', resumeId)
      .eq('job_id', jobId)
      .maybeSingle();

    const fallbackGaps = analyzeResumeGaps(normalizeResumeAnalysis(resume.analysis), normalizeJobAnalysis(job.analysis));
    const context = buildResumeChatContext(resume.analysis, job.analysis, {
      missing_skills: Array.isArray(gap?.missing_skills) ? gap.missing_skills : fallbackGaps.missingSkills,
      fit_score: typeof gap?.fit_score === 'number' ? gap.fit_score : fallbackGaps.fitScore,
    });
    const content = await editResumeSection(section, context);

    return res.status(200).json({
      success: true,
      resumeId,
      jobId,
      section,
      content,
      usedPersistedGapAnalysis: Boolean(gap),
    });
  } catch (error) {
    return handleApiError(res, error, 'Resume section editing failed');
  }
}
