/**
 * POST /api/job/analyze
 * Analyzes a job description and stores structured job analysis.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, assertMethod, getRequiredString, handleApiError, validateMeaningfulLength } from '../../../lib/api/http';
import { analyzeJob } from '../../../lib/ai/analyzeJob';
import { LIMITS, normalizeWhitespace } from '../../../lib/text';
import { supabaseAdmin } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const rawText = normalizeWhitespace(getRequiredString(req.body, 'raw_text', LIMITS.maxJobPromptChars * 2));
    validateMeaningfulLength(rawText, 'job description');

    const analysis = await analyzeJob(rawText);

    const { data, error } = await supabaseAdmin
      .from('jobs')
      .insert({
        title: analysis.title,
        raw_text: rawText,
        analysis,
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(500, 'Failed to save job analysis.', 'DATABASE_ERROR', error.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Job analyzed successfully.',
      job: data,
    });
  } catch (error) {
    return handleApiError(res, error, 'Job analysis failed');
  }
}
