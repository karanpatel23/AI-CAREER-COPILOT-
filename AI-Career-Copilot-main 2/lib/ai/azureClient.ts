/**
 * Azure OpenAI Client Configuration
 *
 * Initializes Azure OpenAI clients for chat completions and embeddings.
 * Required environment variables are validated up front and endpoint formatting is normalized.
 */

import OpenAI from 'openai';
import { azureDeploymentBaseUrl, requireEnv } from '../env';

const azureEndpoint = requireEnv('AZURE_OPENAI_ENDPOINT');
const azureApiKey = requireEnv('AZURE_OPENAI_API_KEY');
const azureApiVersion = requireEnv('AZURE_OPENAI_API_VERSION');
const chatDeployment = requireEnv('AZURE_OPENAI_DEPLOYMENT');
const embeddingDeployment = requireEnv('AZURE_OPENAI_EMBEDDING_DEPLOYMENT');

export const azureOpenAIChat = new OpenAI({
  apiKey: azureApiKey,
  baseURL: azureDeploymentBaseUrl(azureEndpoint, chatDeployment),
  defaultQuery: { 'api-version': azureApiVersion },
  defaultHeaders: { 'api-key': azureApiKey },
});

export const azureOpenAIEmbedding = new OpenAI({
  apiKey: azureApiKey,
  baseURL: azureDeploymentBaseUrl(azureEndpoint, embeddingDeployment),
  defaultQuery: { 'api-version': azureApiVersion },
  defaultHeaders: { 'api-key': azureApiKey },
});

export const azureDeployments = {
  chat: chatDeployment,
  embedding: embeddingDeployment,
};
