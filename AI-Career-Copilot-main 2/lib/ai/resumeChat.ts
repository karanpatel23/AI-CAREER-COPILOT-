/**
 * Resume-Aware Chat Module
 *
 * Provides a context-aware LLM interface for resume questions and targeted editing tasks.
 */

import { LIMITS, sanitizeModelText, truncateText } from '../text';
import { azureDeployments, azureOpenAIChat } from './azureClient';

export type ResumeChatContext = {
  resumeSummary: string;
  resumeSkills: string[];
  resumeExperience: string[];
  resumeProjects: string[];
  resumeEducation: string | null;
  resumeCertifications: string[];
  resumeKeywords: string[];
  jobTitle: string;
  jobSummary: string;
  jobSkills: string[];
  jobMustHaveSkills: string[];
  jobPreferredSkills: string[];
  jobResponsibilities: string[];
  jobTone: string;
  missingSkills: string[];
  fitScore: number;
};

function joinList(values: string[], fallback: string): string {
  return values.length ? values.join(', ') : fallback;
}

export async function resumeAwareChat(
  context: ResumeChatContext,
  userQuestion: string
): Promise<string> {
  const question = truncateText(userQuestion, LIMITS.maxUserInstructionChars);

  if (!question) {
    throw new Error('Question or instruction is required');
  }

  const systemPrompt = `
You are a professional career coach, resume strategist, and ATS optimization expert.

Non-negotiable rules:
- Use ONLY the provided resume and job context.
- Do NOT invent experience, roles, companies, dates, degrees, certifications, tools, metrics, or projects.
- If the user asks for something unsupported, say what can be improved truthfully instead.
- Keep output polished, direct, and ready for the user to paste into a resume or job application.
- Do not return raw JSON unless explicitly asked.
- Do not include filler openings like "Sure" or "Here is".
`;

  const experienceText =
    context.resumeExperience.length > 0
      ? context.resumeExperience.map(exp => `- ${exp}`).join('\n')
      : 'No experience listed';

  const projectsText =
    context.resumeProjects.length > 0
      ? context.resumeProjects.map(project => `- ${project}`).join('\n')
      : 'No projects listed';

  const contextPrompt = truncateText(
    `
===== RESUME CONTEXT =====
Summary: ${context.resumeSummary || 'No summary listed'}
Skills: ${joinList(context.resumeSkills, 'No skills listed')}
Certifications: ${joinList(context.resumeCertifications, 'No certifications listed')}
Keywords: ${joinList(context.resumeKeywords, 'No keywords listed')}
Education: ${context.resumeEducation || 'No education listed'}

Experience:
${experienceText}

Projects:
${projectsText}

===== JOB CONTEXT =====
Job Title: ${context.jobTitle || 'No job title listed'}
Job Summary: ${context.jobSummary || 'No job summary listed'}
Tone: ${context.jobTone || 'general'}
Must-have Skills: ${joinList(context.jobMustHaveSkills, 'No must-have skills listed')}
Preferred Skills: ${joinList(context.jobPreferredSkills, 'No preferred skills listed')}
All Skills: ${joinList(context.jobSkills, 'No job skills listed')}
Responsibilities:
${context.jobResponsibilities.length ? context.jobResponsibilities.map(item => `- ${item}`).join('\n') : 'No responsibilities listed'}

Missing Skills: ${joinList(context.missingSkills, 'None identified')}
Current Fit Score: ${Math.round(Math.max(0, Math.min(1, context.fitScore)) * 100)}%
`,
    LIMITS.maxChatContextChars
  );

  const response = await azureOpenAIChat.chat.completions.create({
    model: azureDeployments.chat,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'assistant', content: contextPrompt },
      { role: 'user', content: question },
    ],
    temperature: 0.25,
  });

  const answer = sanitizeModelText(response.choices[0]?.message?.content ?? '');

  if (!answer) {
    throw new Error('Empty response from Azure OpenAI');
  }

  return answer;
}
