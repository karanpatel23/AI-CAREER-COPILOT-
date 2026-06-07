/**
 * Text Embedding Module
 *
 * Generates vector embeddings from optimized resume/job signal text.
 */

import { LIMITS, hasMeaningfulText, truncateText } from '../text';
import { azureDeployments, azureOpenAIEmbedding } from './azureClient';

export async function getTextEmbedding(text: string): Promise<number[]> {
  const normalizedText = truncateText(text, LIMITS.maxEmbeddingChars);

  if (!hasMeaningfulText(normalizedText, 30)) {
    throw new Error('Cannot generate an embedding for empty or meaningless text');
  }

  const response = await azureOpenAIEmbedding.embeddings.create({
    model: azureDeployments.embedding,
    input: normalizedText,
  });

  const embedding = response.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('No embedding returned from Azure OpenAI');
  }

  return embedding;
}

// Backward-compatible alias used by existing routes.
export const getResumeEmbedding = getTextEmbedding;
