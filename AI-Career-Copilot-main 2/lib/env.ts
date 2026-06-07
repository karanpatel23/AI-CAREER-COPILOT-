/**
 * Server-side environment variable helpers.
 * Fails fast with clear errors instead of relying on unsafe non-null assertions.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function azureDeploymentBaseUrl(endpoint: string, deployment: string): string {
  const normalizedEndpoint = endpoint.replace(/\/+$/, '');
  return `${normalizedEndpoint}/openai/deployments/${deployment}`;
}
