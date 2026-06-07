/**
 * POST /api/resume/rewrite-section
 * Rewrites a specific resume section using a given mode/style.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getRequiredString, getRequiredUuid, handleApiError } from '../../../lib/api/http';
import { isRewriteMode, rewriteModes, rewriteResumeSection } from '../../../lib/ai/resumeSectionRewrite';
import { analyzeResumeGaps } from '../../../lib/ai/resumeGapAnalysis';
import { normalizeJobAnalysis, normalizeResumeAnalysis } from '../../../lib/resumeFormatters';
import { LIMITS } from '../../../lib/text';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const resumeId = getRequiredUuid(req.body, 'resumeId');
    const jobId = getRequiredUuid(req.body, 'jobId');
    const section = getRequiredString(req.body, 'section');
    const currentContent = getRequiredString(req.body, 'currentContent', LIMITS.maxSectionContentChars);
    const mode = getRequiredString(req.body, 'mode');

    if (!isRewriteMode(mode)) {
      throw new ApiError(400, `mode must be one of: ${rewriteModes.join(', ')}.`, 'VALIDATION_ERROR');
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
      throw new ApiError(409, 'Resume and job must both be analyzed before rewriting.', 'ANALYSIS_MISSING');
    }

    const resumeAnalysis = normalizeResumeAnalysis(resume.analysis);
    const jobAnalysis = normalizeJobAnalysis(job.analysis);
    const fallbackGaps = analyzeResumeGaps(resumeAnalysis, jobAnalysis);

    const { data: gaps } = await supabaseAdmin
      .from('resume_job_gaps')
      .select('missing_skills')
      .eq('resume_id', resumeId)
      .eq('job_id', jobId)
      .maybeSingle();

    const updatedContent = await rewriteResumeSection({
      section,
      currentContent,
      resumeSummary: resumeAnalysis.summary,
      resumeSkills: resumeAnalysis.skills,
      experienceDescriptions: resumeAnalysis.experienceDescriptions,
      projects: resumeAnalysis.projects,
      education: resumeAnalysis.education,
      certifications: resumeAnalysis.certifications,
      jobTitle: jobAnalysis.title,
      jobSkills: jobAnalysis.skills,
      mustHaveSkills: jobAnalysis.must_have_skills,
      preferredSkills: jobAnalysis.preferred_skills,
      missingSkills: Array.isArray(gaps?.missing_skills) ? gaps.missing_skills : fallbackGaps.missingSkills,
      mode,
    });

    return res.status(200).json({
      success: true,
      resumeId,
      jobId,
      section,
      mode,
      content: updatedContent,
      usedPersistedGapAnalysis: Boolean(gaps),
    });
  } catch (error) {
    return handleApiError(res, error, 'Resume section rewrite failed');
  }
}
