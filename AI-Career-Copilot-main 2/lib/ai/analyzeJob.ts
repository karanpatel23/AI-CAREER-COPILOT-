/**
 * Job Analysis Module
 *
 * Extracts high-signal, structured requirements from job descriptions.
 */

import type { JobAnalysis } from '../types/jobAnalysis';
import { LIMITS, hasMeaningfulText, truncateText } from '../text';
import { normalizeJobAnalysis } from '../resumeFormatters';
import { azureDeployments, azureOpenAIChat } from './azureClient';
import { parseJsonObject } from './json';

export type { JobAnalysis } from '../types/jobAnalysis';

export async function analyzeJob(rawText: string): Promise<JobAnalysis> {
  const normalizedText = truncateText(rawText, LIMITS.maxJobPromptChars);

  if (!hasMeaningfulText(normalizedText)) {
    throw new Error('Job description is too short or unclear to analyze. Provide the full job posting with responsibilities and requirements.');
  }

  const systemPrompt = `
You are a senior recruiter and talent-intelligence analyst.
Your job is to extract job requirements accurately for resume matching and tailoring.
Return ONLY valid JSON. Do not include markdown, explanations, or comments.
Never infer requirements that are not supported by the job description.
`;

  const userPrompt = `
Analyze the job description and return JSON matching this exact schema:

{
  "title": string,
  "summary": string,
  "skills": string[],
  "must_have_skills": string[],
  "preferred_skills": string[],
  "responsibilities": string[],
  "keywords": string[],
  "tools": string[],
  "seniority": "junior" | "mid" | "senior" | "lead" | "unknown",
  "experience_years": number | null,
  "education": string | null,
  "tone": "technical" | "business" | "leadership" | "customer_facing" | "general",
  "domain": string | null
}

Extraction rules:
- "must_have_skills" = explicitly required qualifications, technologies, tools, certifications, domain knowledge, or core competencies.
- "preferred_skills" = nice-to-have/preferred/bonus items only.
- "skills" = deduplicated union of must-have skills, preferred skills, and important tools.
- Normalize common abbreviations: JS→JavaScript, TS→TypeScript, React.js→React, PostgreSQL/Postgres→PostgreSQL.
- Keep skills specific. Prefer "Financial modeling" over "Finance" when supported.
- Do not include generic filler unless it is clearly important to the role.
- Infer seniority conservatively from title, years, ownership, leadership, and scope.
- If years are shown as a range, use the minimum required year.
- Summary must be 1 concise sentence, not a paragraph.
- Return empty arrays for missing lists; use null for missing scalar fields.

Job description:
"""
${normalizedText}
"""
`;

  const response = await azureOpenAIChat.chat.completions.create({
    model: azureDeployments.chat,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const parsed = parseJsonObject<unknown>(
    response.choices[0]?.message?.content,
    'job analysis'
  );

  return normalizeJobAnalysis(parsed);
}
