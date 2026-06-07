/**
 * Resume Section Rewrite Module
 *
 * Rewrites specific resume sections with controlled, truthful style modes.
 */

import { LIMITS, sanitizeModelText, truncateText } from '../text';
import { azureDeployments, azureOpenAIChat } from './azureClient';

export const rewriteModes = [
  'shorten',
  'more_technical',
  'ats_optimized',
  'impact_focused',
  'quantified',
] as const;

export type RewriteMode = (typeof rewriteModes)[number];

export interface RewriteInput {
  section: string;
  currentContent: string;
  resumeSummary: string;
  resumeSkills: string[];
  experienceDescriptions: {
    role: string;
    company?: string | null;
    description: string[];
  }[];
  projects: {
    name: string;
    description: string[];
    link?: string | null;
  }[];
  education: string | null;
  certifications: string[];
  jobTitle: string;
  jobSkills: string[];
  mustHaveSkills: string[];
  preferredSkills: string[];
  missingSkills: string[];
  mode: RewriteMode;
}

export function isRewriteMode(value: string): value is RewriteMode {
  return rewriteModes.includes(value as RewriteMode);
}

export async function rewriteResumeSection(input: RewriteInput): Promise<string> {
  const currentContent = truncateText(input.currentContent, LIMITS.maxSectionContentChars);

  if (!currentContent.trim()) {
    throw new Error('currentContent is required');
  }

  const modeInstructions: Record<RewriteMode, string> = {
    shorten: 'Make the content more concise without losing important meaning or job relevance.',
    more_technical: 'Use precise technical or domain language only where it is already supported by the resume.',
    ats_optimized: 'Naturally include relevant existing keywords from the target job without keyword stuffing.',
    impact_focused: 'Emphasize outcomes, ownership, scope, and value delivered without inventing facts.',
    quantified: 'Preserve existing metrics and make measurable impact clearer; never create fake numbers.',
  };

  const systemPrompt = `
You are an expert resume editor.
Return ONLY the rewritten section content. No JSON. No markdown code fences. No explanations.

Rules:
- Rewrite ONLY the requested section.
- Use ONLY provided resume facts.
- Do NOT invent roles, companies, dates, degrees, achievements, tools, certifications, or metrics.
- If a job keyword is unsupported by the resume, do not add it.
- Output must be polished, professional, and ready to paste into a resume.
`;

  const userPrompt = `
Rewrite section: ${input.section}
Mode: ${input.mode} — ${modeInstructions[input.mode]}

Current section content:
"""
${currentContent}
"""

Resume facts:
Summary: ${input.resumeSummary || 'No resume summary provided'}
Skills: ${input.resumeSkills.join(', ') || 'No skills provided'}
Certifications: ${input.certifications.join(', ') || 'No certifications provided'}
Education: ${input.education || 'No education provided'}

Work experience:
${input.experienceDescriptions.length > 0
  ? input.experienceDescriptions
      .map(
        exp =>
          `- ${exp.role}${exp.company ? ` @ ${exp.company}` : ''}:\n${exp.description
            .map(d => `  • ${d}`)
            .join('\n')}`
      )
      .join('\n')
  : 'No structured experience provided'}

Projects:
${input.projects.length > 0
  ? input.projects
      .map(
        project =>
          `- ${project.name}:\n${project.description.map(d => `  • ${d}`).join('\n')}`
      )
      .join('\n')
  : 'No projects provided'}

Target job:
- Title: ${input.jobTitle || 'Unknown'}
- Must-have skills: ${input.mustHaveSkills.join(', ') || 'None extracted'}
- Preferred skills: ${input.preferredSkills.join(', ') || 'None extracted'}
- All relevant skills: ${input.jobSkills.join(', ') || 'None extracted'}
- Missing skills: ${input.missingSkills.join(', ') || 'None identified'}

Output rules:
- Keep formatting consistent with the section type.
- For bullets, use hyphen bullets only.
- Do not include unsupported missing skills in the rewritten content.
`;

  const response = await azureOpenAIChat.chat.completions.create({
    model: azureDeployments.chat,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.22,
  });

  const content = sanitizeModelText(response.choices[0]?.message?.content ?? '');

  if (!content) {
    throw new Error('Empty response from Azure OpenAI');
  }

  return content;
}
