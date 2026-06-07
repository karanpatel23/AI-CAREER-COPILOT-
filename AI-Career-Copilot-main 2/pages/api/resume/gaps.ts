/**
 * POST /api/resume/gaps
 * Computes resume-job gaps, production-grade fit score, and improvement suggestions.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getRequiredUuid, handleApiError } from '../../../lib/api/http';
import { analyzeResumeGaps } from '../../../lib/ai/resumeGapAnalysis';
import { suggestResumeImprovements } from '../../../lib/ai/suggestResumeImprovements';
import { normalizeJobAnalysis, normalizeResumeAnalysis } from '../../../lib/resumeFormatters';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const resumeId = getRequiredUuid(req.body, 'resumeId');
    const jobId = getRequiredUuid(req.body, 'jobId');

    const [{ data: resume, error: resumeError }, { data: job, error: jobError }] = await Promise.all([
      supabaseAdmin.from('resumes').select('raw_text, analysis').eq('id', resumeId).single(),
      supabaseAdmin.from('jobs').select('raw_text, analysis').eq('id', jobId).single(),
    ]);

    if (resumeError || !resume) {
      throw new ApiError(404, 'Resume not found.', 'RESUME_NOT_FOUND');
    }

    if (jobError || !job) {
      throw new ApiError(404, 'Job not found.', 'JOB_NOT_FOUND');
    }

    if (!resume.analysis) {
      throw new ApiError(409, 'Resume has not been analyzed yet.', 'RESUME_ANALYSIS_MISSING', undefined, 'Run /api/resume/analyze before gap analysis.');
    }

    if (!job.analysis) {
      throw new ApiError(409, 'Job has not been analyzed yet.', 'JOB_ANALYSIS_MISSING', undefined, 'Run /api/job/analyze before gap analysis.');
    }

    const resumeAnalysis = normalizeResumeAnalysis(resume.analysis);
    const jobAnalysis = normalizeJobAnalysis(job.analysis);
    const gaps = analyzeResumeGaps(resumeAnalysis, jobAnalysis);

    const suggestions = await suggestResumeImprovements(
      typeof resume.raw_text === 'string' ? resume.raw_text : '',
      typeof job.raw_text === 'string' ? job.raw_text : '',
      gaps,
      resumeAnalysis.experienceDescriptions,
      resumeAnalysis.projects
    );

    const { error: upsertError } = await supabaseAdmin
      .from('resume_job_gaps')
      .upsert(
        {
          resume_id: resumeId,
          job_id: jobId,
          missing_skills: gaps.missingSkills,
          experience_gap: gaps.experienceGap,
          seniority_mismatch: gaps.seniorityMismatch,
          fit_score: gaps.fitScore,
          suggestions,
        },
        { onConflict: 'resume_id,job_id' }
      );

    if (upsertError) {
      throw new ApiError(500, 'Failed to persist gap analysis.', 'DATABASE_ERROR', upsertError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Resume-job gaps analyzed successfully.',
      resumeId,
      jobId,
      fitScore: gaps.fitScore,
      componentScores: gaps.componentScores,
      gaps: {
        missingSkills: gaps.missingSkills,
        matchedSkills: gaps.matchedSkills,
        mustHaveMatchedSkills: gaps.mustHaveMatchedSkills,
        mustHaveMissingSkills: gaps.mustHaveMissingSkills,
        preferredMatchedSkills: gaps.preferredMatchedSkills,
        preferredMissingSkills: gaps.preferredMissingSkills,
        experienceGap: gaps.experienceGap,
        seniorityMismatch: gaps.seniorityMismatch,
        missingExperienceOrProjects: gaps.missingExperienceOrProjects,
      },
      suggestions,
    });
  } catch (error) {
    return handleApiError(res, error, 'Resume gap analysis failed');
  }
}
