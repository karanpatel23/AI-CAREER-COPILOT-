import { stripCodeFences } from '../text';

export function parseJsonObject<T>(content: string | null | undefined, label: string): T {
  if (!content?.trim()) {
    throw new Error(`Empty ${label} response from Azure OpenAI`);
  }

  const trimmed = stripCodeFences(content.trim());

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // Fall through to final error below.
      }
    }
  }

  throw new Error(`Failed to parse ${label} response as JSON`);
}
