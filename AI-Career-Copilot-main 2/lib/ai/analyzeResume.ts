/**
 * Resume Analysis Module
 *
 * Extracts structured, factual resume data for matching, gap analysis, and tailoring.
 */

import { ResumeAnalysis } from '../types/resumeAnalysis';
import { LIMITS, hasMeaningfulText, truncateText } from '../text';
import { azureDeployments, azureOpenAIChat } from './azureClient';
import { parseJsonObject } from './json';
import { normalizeResumeAnalysis } from '../resumeFormatters';

export async function analyzeResume(rawText: string): Promise<ResumeAnalysis> {
  const normalizedText = truncateText(rawText, LIMITS.maxResumePromptChars);

  if (!hasMeaningfulText(normalizedText)) {
    throw new Error('Resume text is too short or unclear to analyze. Upload a text-readable resume with work history, skills, and education.');
  }

  const systemPrompt = `
You are a senior resume parser and recruiter.
Extract only facts explicitly present in the resume text.
Return ONLY valid JSON. Do not include markdown, explanations, or comments.
Do not invent missing skills, companies, metrics, dates, degrees, certifications, or projects.
`;

  const userPrompt = `
Analyze the resume and return JSON matching this exact schema:

{
  "summary": string,
  "skills": string[],
  "roles": string[],
  "seniority": "junior" | "mid" | "senior" | "lead" | "unknown",
  "experience_years": number | null,
  "education": string | null,
  "certifications": string[],
  "keywords": string[],
  "achievements": string[],
  "experienceDescriptions": [
    {
      "role": string,
      "company": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "description": string[]
    }
  ],
  "projects": [
    {
      "name": string,
      "description": string[],
      "link": string | null
    }
  ]
}

Extraction rules:
- Preserve original role titles, company names, schools, dates, project names, and metrics exactly when possible.
- Normalize common skill abbreviations, but never add skills that are not supported by resume content.
- "summary" must be a factual 1-sentence candidate positioning summary based on the resume.
- "skills" should include technical tools, domain skills, analytical skills, and role-specific skills.
- "keywords" should include ATS-relevant keywords already evidenced by the resume.
- "achievements" should include measurable or high-impact outcomes already present in the resume.
- Each experience description bullet should be concise, factual, and based on the resume text.
- If a section is missing, return an empty array or null. Do not guess.

Resume text:
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
    'resume analysis'
  );

  return normalizeResumeAnalysis(parsed);
}
