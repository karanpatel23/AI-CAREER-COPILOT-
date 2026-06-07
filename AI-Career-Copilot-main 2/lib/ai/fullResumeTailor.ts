/**
 * Full Resume Tailoring Module
 *
 * Creates one consistent, structured tailored resume response in a single model call.
 */

import type { JobAnalysis } from '../types/jobAnalysis';
import type { ResumeAnalysis } from '../types/resumeAnalysis';
import { LIMITS, sanitizeModelText, truncateText } from '../text';
import { buildJobSignalText, buildResumeSignalText, normalizeJobAnalysis, normalizeResumeAnalysis, uniqueStrings } from '../resumeFormatters';
import { azureDeployments, azureOpenAIChat } from './azureClient';
import { parseJsonObject } from './json';

export const tailorModes = ['ats_optimized', 'concise', 'impact'] as const;
export type TailorMode = (typeof tailorModes)[number];

type TailorInput = {
  resumeAnalysis: ResumeAnalysis | unknown;
  jobAnalysis: JobAnalysis | unknown;
  gaps: {
    missingSkills?: string[];
    mustHaveMissingSkills?: string[];
    preferredMissingSkills?: string[];
  };
  suggestions?: unknown;
  fitScore: number;
  mode: TailorMode;
};

type TailoredExperience = {
  role: string;
  company: string | null;
  dates: string | null;
  bullets: string[];
};

type TailoredProject = {
  name: string;
  bullets: string[];
  link: string | null;
};

type TailoredResumeJson = {
  headline: string;
  summary: string;
  skills: string[];
  experience: TailoredExperience[];
  projects: TailoredProject[];
  education: string | null;
  notes: string[];
};

export type TailoredResume = TailoredResumeJson & {
  mode: TailorMode;
  fitScore: number;
  markdown: string;
};

export function isTailorMode(value: string): value is TailorMode {
  return tailorModes.includes(value as TailorMode);
}

function cleanBullets(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === 'string')
    .map(value => sanitizeModelText(value).replace(/^[-•]\s*/, ''))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeTailoredJson(value: unknown, fallbackResume: ResumeAnalysis): TailoredResumeJson {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  const experience = Array.isArray(record.experience)
    ? record.experience
        .filter(item => item && typeof item === 'object' && !Array.isArray(item))
        .map(item => {
          const exp = item as Record<string, unknown>;
          return {
            role: typeof exp.role === 'string' && exp.role.trim() ? sanitizeModelText(exp.role) : 'Experience',
            company: typeof exp.company === 'string' && exp.company.trim() ? sanitizeModelText(exp.company) : null,
            dates: typeof exp.dates === 'string' && exp.dates.trim() ? sanitizeModelText(exp.dates) : null,
            bullets: cleanBullets(exp.bullets),
          };
        })
        .filter(item => item.bullets.length > 0)
    : [];

  const projects = Array.isArray(record.projects)
    ? record.projects
        .filter(item => item && typeof item === 'object' && !Array.isArray(item))
        .map(item => {
          const project = item as Record<string, unknown>;
          return {
            name: typeof project.name === 'string' && project.name.trim() ? sanitizeModelText(project.name) : 'Project',
            bullets: cleanBullets(project.bullets),
            link: typeof project.link === 'string' && project.link.trim() ? sanitizeModelText(project.link) : null,
          };
        })
        .filter(item => item.bullets.length > 0)
    : [];

  return {
    headline: typeof record.headline === 'string' && record.headline.trim() ? sanitizeModelText(record.headline) : fallbackResume.roles[0] || 'Professional Resume',
    summary: typeof record.summary === 'string' && record.summary.trim() ? sanitizeModelText(record.summary) : fallbackResume.summary,
    skills: uniqueStrings(Array.isArray(record.skills) ? record.skills.filter((item): item is string => typeof item === 'string') : fallbackResume.skills),
    experience,
    projects,
    education: typeof record.education === 'string' && record.education.trim() ? sanitizeModelText(record.education) : fallbackResume.education,
    notes: cleanBullets(record.notes),
  };
}

function markdownList(values: string[]): string {
  return values.map(value => `- ${value}`).join('\n');
}

export function buildTailoredResumeMarkdown(resume: TailoredResumeJson): string {
  const sections: string[] = [];

  sections.push(`# ${resume.headline}`);

  if (resume.summary) {
    sections.push(`## Professional Summary\n${resume.summary}`);
  }

  if (resume.skills.length) {
    sections.push(`## Skills\n${markdownList(resume.skills)}`);
  }

  if (resume.experience.length) {
    const experience = resume.experience
      .map(exp => {
        const heading = [`### ${exp.role}`, exp.company ? `— ${exp.company}` : '', exp.dates ? `(${exp.dates})` : '']
          .filter(Boolean)
          .join(' ');
        return `${heading}\n${markdownList(exp.bullets)}`;
      })
      .join('\n\n');
    sections.push(`## Professional Experience\n${experience}`);
  }

  if (resume.projects.length) {
    const projects = resume.projects
      .map(project => `${[`### ${project.name}`, project.link ? `(${project.link})` : ''].filter(Boolean).join(' ')}\n${markdownList(project.bullets)}`)
      .join('\n\n');
    sections.push(`## Projects\n${projects}`);
  }

  if (resume.education) {
    sections.push(`## Education\n${resume.education}`);
  }

  if (resume.notes.length) {
    sections.push(`## Tailoring Notes\n${markdownList(resume.notes)}`);
  }

  return sections.join('\n\n').trim();
}

export async function tailorFullResume(input: TailorInput): Promise<TailoredResume> {
  const resumeAnalysis = normalizeResumeAnalysis(input.resumeAnalysis);
  const jobAnalysis = normalizeJobAnalysis(input.jobAnalysis);
  const missingSkills = uniqueStrings(Array.isArray(input.gaps.missingSkills) ? input.gaps.missingSkills : []);
  const mustHaveMissingSkills = uniqueStrings(Array.isArray(input.gaps.mustHaveMissingSkills) ? input.gaps.mustHaveMissingSkills : []);
  const preferredMissingSkills = uniqueStrings(Array.isArray(input.gaps.preferredMissingSkills) ? input.gaps.preferredMissingSkills : []);
  const fitScore = Math.max(0, Math.min(1, input.fitScore || 0));
  const modeInstruction: Record<TailorMode, string> = {
    ats_optimized: 'Prioritize ATS-friendly keywords from the job that are truthfully supported by the resume. Keep formatting clean and standard.',
    concise: 'Make the resume tighter and more readable while preserving the strongest relevant evidence.',
    impact: 'Emphasize outcomes, ownership, scope, and business value where the original resume already supports them.',
  };

  const systemPrompt = `
You are an expert resume writer and ATS optimization specialist.
Return ONLY valid JSON. No markdown outside JSON. No explanations.

Strict truthfulness rules:
- Use ONLY facts present in the resume context.
- Do NOT invent skills, tools, dates, employers, titles, certifications, degrees, projects, metrics, or responsibilities.
- You may reorder, condense, and rephrase existing facts to align with the job.
- If a job skill is missing, do not pretend the candidate has it. Mention it only in notes as a gap or learning recommendation.
- Output must be polished, professional, and ready to render directly to users.
`;

  const userPrompt = `
Tailor the resume for this job using mode: ${input.mode}
Mode guidance: ${modeInstruction[input.mode]}

Return JSON exactly in this schema:
{
  "headline": string,
  "summary": string,
  "skills": string[],
  "experience": [
    {
      "role": string,
      "company": string | null,
      "dates": string | null,
      "bullets": string[]
    }
  ],
  "projects": [
    {
      "name": string,
      "bullets": string[],
      "link": string | null
    }
  ],
  "education": string | null,
  "notes": string[]
}

Quality rules:
- Summary: 2-3 lines max, role-aligned, no hype, no unsupported claims.
- Skills: only existing resume skills; order by relevance to must-have job skills.
- Experience bullets: 1-5 bullets per role, action-oriented, specific, and truthful.
- Projects: keep only relevant projects or rewrite existing projects to show relevance.
- Notes: list missing must-have skills and honest improvement suggestions. Keep notes separate from the resume sections.
- Do not include raw JSON strings inside any field.

Resume context:
"""
${truncateText(buildResumeSignalText(resumeAnalysis), LIMITS.maxChatContextChars)}
"""

Structured resume facts:
${JSON.stringify(resumeAnalysis, null, 2)}

Job context:
"""
${truncateText(buildJobSignalText(jobAnalysis), LIMITS.maxChatContextChars)}
"""

Structured job requirements:
${JSON.stringify(jobAnalysis, null, 2)}

Fit score: ${Math.round(fitScore * 100)}%
Missing skills: ${missingSkills.join(', ') || 'None identified'}
Missing must-have skills: ${mustHaveMissingSkills.join(', ') || 'None identified'}
Missing preferred skills: ${preferredMissingSkills.join(', ') || 'None identified'}
Existing suggestions: ${typeof input.suggestions === 'string' ? truncateText(input.suggestions, 3000) : 'None'}
`;

  const response = await azureOpenAIChat.chat.completions.create({
    model: azureDeployments.chat,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.18,
    response_format: { type: 'json_object' },
  });

  const parsed = parseJsonObject<unknown>(response.choices[0]?.message?.content, 'tailored resume');
  const normalized = normalizeTailoredJson(parsed, resumeAnalysis);

  return {
    ...normalized,
    mode: input.mode,
    fitScore,
    markdown: buildTailoredResumeMarkdown(normalized),
  };
}
