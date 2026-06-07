/**
 * Resume Improvement Suggestions Module
 *
 * Generates clean, actionable suggestions for improving resume-job alignment.
 */

import { LIMITS, sanitizeModelText, truncateText } from '../text';
import { azureDeployments, azureOpenAIChat } from './azureClient';

export async function suggestResumeImprovements(
  resumeText: string,
  jobText: string,
  gaps: {
    missingSkills?: string[];
    mustHaveMissingSkills?: string[];
    preferredMissingSkills?: string[];
    experienceGap?: number;
    seniorityMismatch?: unknown;
    componentScores?: unknown;
  },
  experienceDescriptions: {
    role: string;
    company?: string | null;
    description: string[];
  }[],
  projects: {
    name: string;
    description: string[];
    link?: string | null;
  }[]
): Promise<string> {
  const systemPrompt = `
You are an expert resume coach and ATS optimization specialist.
Return polished markdown only. Do not return JSON. Do not include code fences.

Rules:
- Use ONLY the provided resume and job data.
- Do NOT invent experience, credentials, projects, tools, or metrics.
- Separate truthful rewrites from gaps the candidate may need to learn/add later.
- Be specific and actionable; avoid generic advice.
`;

  const userPrompt = `
Create concise resume-improvement feedback for this resume-job pair.

Resume text:
"""
${truncateText(resumeText, 12000)}
"""

Job description:
"""
${truncateText(jobText, 10000)}
"""

Computed gap analysis:
${JSON.stringify(gaps, null, 2)}

Structured work experience:
${experienceDescriptions.length > 0
  ? experienceDescriptions
      .map(
        exp =>
          `- ${exp.role}${exp.company ? ` @ ${exp.company}` : ''}:\n${exp.description
            .map(d => `  • ${d}`)
            .join('\n')}`
      )
      .join('\n')
  : 'No experience descriptions provided'}

Projects:
${projects.length > 0
  ? projects
      .map(
        project =>
          `- ${project.name}:\n${project.description.map(d => `  • ${d}`).join('\n')}`
      )
      .join('\n')
  : 'No projects provided'}

Return exactly these markdown sections:
## Best Alignment Opportunities
- 3-5 bullets on what to emphasize or reorder.

## Missing or Weak Signals
- List must-have gaps first, then preferred gaps. Be honest and do not imply the candidate has unsupported skills.

## Bullet Rewrite Priorities
- 3-5 specific suggestions for rewriting current bullets, tied to existing experience/projects.

## ATS Cleanup
- 3-5 formatting/keyword recommendations that are safe and truthful.

Keep the total response under ${LIMITS.maxUserInstructionChars} characters.
`;

  const response = await azureOpenAIChat.chat.completions.create({
    model: azureDeployments.chat,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.25,
  });

  const content = sanitizeModelText(response.choices[0]?.message?.content ?? '');

  if (!content) {
    throw new Error('Empty response from Azure OpenAI');
  }

  return content;
}
