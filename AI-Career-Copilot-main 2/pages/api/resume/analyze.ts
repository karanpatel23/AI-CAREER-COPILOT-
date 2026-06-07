/**
 * POST /api/resume/analyze
 * Analyzes a stored resume using Azure OpenAI and persists structured analysis.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getRequiredUuid, handleApiError, validateMeaningfulLength } from '../../../lib/api/http';
import { analyzeResume } from '../../../lib/ai/analyzeResume';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const resumeId = getRequiredUuid(req.body, 'resumeId');

    const { data: resume, error: fetchError } = await supabaseAdmin
      .from('resumes')
      .select('raw_text')
      .eq('id', resumeId)
      .single();

    if (fetchError || !resume) {
      throw new ApiError(404, 'Resume not found.', 'RESUME_NOT_FOUND', undefined, 'Upload a resume first, then retry analysis.');
    }

    const rawText = typeof resume.raw_text === 'string' ? resume.raw_text : '';
    validateMeaningfulLength(rawText, 'resume text');

    const analysis = await analyzeResume(rawText);

    const { error: updateError } = await supabaseAdmin
      .from('resumes')
      .update({ analysis })
      .eq('id', resumeId);

    if (updateError) {
      throw new ApiError(500, 'Failed to save resume analysis.', 'DATABASE_ERROR', updateError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Resume analyzed successfully.',
      resumeId,
      analysis,
    });
  } catch (error) {
    return handleApiError(res, error, 'Resume analysis failed');
  }
}
