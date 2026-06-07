/**
 * Resume Section Editor Module
 *
 * Provides targeted rewriting of individual resume sections using resume-aware context.
 */

import { ResumeSection } from '../types/resumeSections';
import { ResumeChatContext, resumeAwareChat } from './resumeChat';

export const editableResumeSections: ResumeSection[] = [
  'summary',
  'skills',
  'experience',
  'education',
  'projects',
];

export function isResumeSection(value: string): value is ResumeSection {
  return editableResumeSections.includes(value as ResumeSection);
}

export async function editResumeSection(
  section: ResumeSection,
  context: ResumeChatContext
): Promise<string> {
  const instructions: Record<ResumeSection, string> = {
    summary: `
Rewrite the RESUME SUMMARY for the target job.

Output rules:
- 2-3 polished lines max.
- Align with must-have job skills only where the resume supports them.
- Do not add unsupported skills, seniority, industries, or outcomes.
- Return only the summary text.
`,
    skills: `
Rewrite the SKILLS section for the target job.

Output rules:
- Use only existing resume skills.
- Prioritize must-have job skills that are already present in the resume.
- Group skills into clean keyword lines or hyphen bullets.
- Do not include missing or unsupported skills.
`,
    experience: `
Rewrite the EXPERIENCE section for the target job.

Output rules:
- Reframe existing experience only.
- Use strong action verbs and job-relevant wording.
- Preserve role, company, date, and metric truthfulness.
- Use hyphen bullets. Do not invent responsibilities or numbers.
`,
    education: `
Rewrite the EDUCATION section.

Output rules:
- Use only education details present in the resume context.
- Do not invent degrees, schools, dates, honors, coursework, or certifications.
- Keep it clean, professional, and concise.
`,
    projects: `
Rewrite the PROJECTS section for the target job.

Output rules:
- Use only provided project content.
- Emphasize relevance to the target job where already supported.
- Preserve project names, links, tools, and outcomes truthfully.
- Use hyphen bullets. Do not invent features, tools, links, or results.
`,
  };

  return resumeAwareChat(context, instructions[section]);
}
