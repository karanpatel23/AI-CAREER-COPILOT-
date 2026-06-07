/**
 * POST /api/job/embedding
 * Generates and stores a vector embedding for a job using compact requirement signal text.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getRequiredUuid, handleApiError } from '../../../lib/api/http';
import { getTextEmbedding } from '../../../lib/ai/embedResume';
import { buildJobSignalText, normalizeJobAnalysis } from '../../../lib/resumeFormatters';
import { LIMITS, truncateText } from '../../../lib/text';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const jobId = getRequiredUuid(req.body, 'jobId');

    const { data: job, error: fetchError } = await supabaseAdmin
      .from('jobs')
      .select('raw_text, analysis')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      throw new ApiError(404, 'Job not found.', 'JOB_NOT_FOUND');
    }

    const embeddingText = job.analysis
      ? buildJobSignalText(normalizeJobAnalysis(job.analysis))
      : truncateText(typeof job.raw_text === 'string' ? job.raw_text : '', LIMITS.maxEmbeddingChars);

    const embedding = await getTextEmbedding(embeddingText);

    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({ embedding })
      .eq('id', jobId);

    if (updateError) {
      throw new ApiError(500, 'Failed to save job embedding.', 'DATABASE_ERROR', updateError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Job embedding saved successfully.',
      jobId,
      embeddingDimensions: embedding.length,
      source: job.analysis ? 'analysis_signal_text' : 'raw_text',
    });
  } catch (error) {
    return handleApiError(res, error, 'Job embedding failed');
  }
}
