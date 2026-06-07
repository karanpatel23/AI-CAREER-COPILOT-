/**
 * POST /api/resume/tailor
 * Tailors a complete resume for a specific job opportunity.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getEnum, getRequiredUuid, handleApiError } from '../../../lib/api/http';
import { tailorFullResume, tailorModes } from '../../../lib/ai/fullResumeTailor';
import { analyzeResumeGaps } from '../../../lib/ai/resumeGapAnalysis';
import { normalizeJobAnalysis, normalizeResumeAnalysis } from '../../../lib/resumeFormatters';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const resumeId = getRequiredUuid(req.body, 'resumeId');
    const jobId = getRequiredUuid(req.body, 'jobId');
    const mode = getEnum(req.body, 'mode', tailorModes, 'ats_optimized');

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

    if (!resume.analysis) {
      throw new ApiError(409, 'Resume has not been analyzed yet.', 'RESUME_ANALYSIS_MISSING', undefined, 'Run /api/resume/analyze before tailoring.');
    }

    if (!job.analysis) {
      throw new ApiError(409, 'Job has not been analyzed yet.', 'JOB_ANALYSIS_MISSING', undefined, 'Run /api/job/analyze before tailoring.');
    }

    const resumeAnalysis = normalizeResumeAnalysis(resume.analysis);
    const jobAnalysis = normalizeJobAnalysis(job.analysis);

    const { data: gapRow } = await supabaseAdmin
      .from('resume_job_gaps')
      .select('missing_skills, suggestions, fit_score')
      .eq('resume_id', resumeId)
      .eq('job_id', jobId)
      .maybeSingle();

    const fallbackGaps = analyzeResumeGaps(resumeAnalysis, jobAnalysis);
    const missingSkills = Array.isArray(gapRow?.missing_skills) ? gapRow.missing_skills : fallbackGaps.missingSkills;
    const fitScore = typeof gapRow?.fit_score === 'number' ? gapRow.fit_score : fallbackGaps.fitScore;

    const tailored = await tailorFullResume({
      resumeAnalysis,
      jobAnalysis,
      gaps: {
        missingSkills,
        mustHaveMissingSkills: fallbackGaps.mustHaveMissingSkills,
        preferredMissingSkills: fallbackGaps.preferredMissingSkills,
      },
      suggestions: gapRow?.suggestions,
      fitScore,
      mode,
    });

    return res.status(200).json({
      success: true,
      message: 'Resume tailored successfully.',
      resumeId,
      jobId,
      usedPersistedGapAnalysis: Boolean(gapRow),
      tailoredResume: tailored,
    });
  } catch (error) {
    return handleApiError(res, error, 'Resume tailoring failed');
  }
}
