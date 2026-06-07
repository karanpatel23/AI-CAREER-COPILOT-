/**
 * POST /api/resume/embedding
 * Generates and stores a vector embedding for a resume using compact signal text.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getRequiredUuid, handleApiError } from '../../../lib/api/http';
import { getTextEmbedding } from '../../../lib/ai/embedResume';
import { buildResumeSignalText, normalizeResumeAnalysis } from '../../../lib/resumeFormatters';
import { LIMITS, truncateText } from '../../../lib/text';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const resumeId = getRequiredUuid(req.body, 'resumeId');

    const { data: resume, error: fetchError } = await supabaseAdmin
      .from('resumes')
      .select('raw_text, analysis')
      .eq('id', resumeId)
      .single();

    if (fetchError || !resume) {
      throw new ApiError(404, 'Resume not found.', 'RESUME_NOT_FOUND');
    }

    const embeddingText = resume.analysis
      ? buildResumeSignalText(normalizeResumeAnalysis(resume.analysis))
      : truncateText(typeof resume.raw_text === 'string' ? resume.raw_text : '', LIMITS.maxEmbeddingChars);

    const embedding = await getTextEmbedding(embeddingText);

    const { error: updateError } = await supabaseAdmin
      .from('resumes')
      .update({ embedding })
      .eq('id', resumeId);

    if (updateError) {
      throw new ApiError(500, 'Failed to save resume embedding.', 'DATABASE_ERROR', updateError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Resume embedding saved successfully.',
      resumeId,
      embeddingDimensions: embedding.length,
      source: resume.analysis ? 'analysis_signal_text' : 'raw_text',
    });
  } catch (error) {
    return handleApiError(res, error, 'Resume embedding failed');
  }
}
