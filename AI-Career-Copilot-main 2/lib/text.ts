export const LIMITS = {
  minMeaningfulTextChars: 80,
  maxResumePromptChars: 24000,
  maxJobPromptChars: 18000,
  maxEmbeddingChars: 12000,
  maxChatContextChars: 16000,
  maxUserInstructionChars: 4000,
  maxSectionContentChars: 8000,
};

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function normalizeWhitespace(value: string): string {
  return value.replace(CONTROL_CHARS, ' ').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function stripCodeFences(value: string): string {
  return value
    .replace(/^```(?:json|markdown|md|text)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

export function sanitizeModelText(value: string): string {
  const stripped = stripCodeFences(normalizeWhitespace(value));
  return stripped
    .replace(/^Here(?:'|’)?s (?:the )?(?:rewritten|tailored|improved) (?:content|resume|section)[:\-]?\s*/i, '')
    .replace(/^Sure[,!]?\s*/i, '')
    .trim();
}

export function truncateText(value: string, maxChars: number): string {
  const cleaned = normalizeWhitespace(value);
  if (cleaned.length <= maxChars) return cleaned;

  const headChars = Math.floor(maxChars * 0.72);
  const tailChars = maxChars - headChars - 120;
  return `${cleaned.slice(0, headChars).trim()}\n\n[...truncated for model input...]\n\n${cleaned.slice(-tailChars).trim()}`;
}

export function hasMeaningfulText(value: string, minChars = LIMITS.minMeaningfulTextChars): boolean {
  const cleaned = normalizeWhitespace(value);
  const alphaNumericCount = (cleaned.match(/[\p{L}\p{N}]/gu) || []).length;
  return cleaned.length >= minChars && alphaNumericCount >= Math.floor(minChars * 0.55);
}

export function compactList(values: string[], maxItems = 30): string[] {
  return values.map(item => normalizeWhitespace(item)).filter(Boolean).slice(0, maxItems);
}

export function bulletize(values: string[]): string {
  const cleanValues = values.map(value => sanitizeModelText(value)).filter(Boolean);
  return cleanValues.map(value => `- ${value.replace(/^[-•]\s*/, '')}`).join('\n');
}
