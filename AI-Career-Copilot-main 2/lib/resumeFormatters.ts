import type { JobAnalysis } from './types/jobAnalysis';
import type { ResumeAnalysis } from './types/resumeAnalysis';
import type { ResumeChatContext } from './ai/resumeChat';
import { LIMITS, compactList, normalizeWhitespace, truncateText } from './text';

export type ExperienceEntry = ResumeAnalysis['experienceDescriptions'][number];
export type ProjectEntry = ResumeAnalysis['projects'][number];

export type ResumeGapRow = {
  missing_skills?: string[] | null;
  fit_score?: number | null;
};

type MaybeRecord = Record<string, unknown>;

const seniorityValues = ['junior', 'mid', 'senior', 'lead', 'unknown'] as const;
const jobToneValues = ['technical', 'business', 'leadership', 'customer_facing', 'general'] as const;

const skillAliases: Record<string, string> = {
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  reactjs: 'react',
  'react.js': 'react',
  react: 'react',
  nextjs: 'next.js',
  'next.js': 'next.js',
  nodejs: 'node.js',
  'node.js': 'node.js',
  node: 'node.js',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  sql: 'sql',
  'ms excel': 'excel',
  excel: 'excel',
  'power bi': 'power bi',
  powerbi: 'power bi',
  tableau: 'tableau',
  'c sharp': 'c#',
  csharp: 'c#',
  'c#': 'c#',
  'c plus plus': 'c++',
  cpp: 'c++',
  'c++': 'c++',
  dotnet: '.net',
  '.net': '.net',
  aws: 'aws',
  'amazon web services': 'aws',
  azure: 'azure',
  gcp: 'google cloud',
  'google cloud platform': 'google cloud',
  'google cloud': 'google cloud',
  ai: 'artificial intelligence',
  ml: 'machine learning',
  'machine learning': 'machine learning',
};

function isRecord(value: unknown): value is MaybeRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => normalizeWhitespace(item))
    .filter(Boolean);
}

export function canonicalSkill(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\breact\.js\b/g, 'react.js')
    .replace(/\bnode\.js\b/g, 'node.js')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9+#.\s-]/g, '')
    .trim();

  const compact = normalized.replace(/[\s-]+/g, '');
  return skillAliases[normalized] || skillAliases[compact] || normalized;
}

export function normalizeSkill(skill: string): string {
  return canonicalSkill(skill);
}

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = normalizeWhitespace(value);
    const key = canonicalSkill(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Number(value.toFixed(1)));
}

export function normalizeResumeAnalysis(value: unknown): ResumeAnalysis {
  const record = isRecord(value) ? value : {};

  const experienceDescriptions = Array.isArray(record.experienceDescriptions)
    ? record.experienceDescriptions
        .filter(isRecord)
        .map(entry => ({
          role: typeof entry.role === 'string' && entry.role.trim() ? normalizeWhitespace(entry.role) : 'Experience',
          company: typeof entry.company === 'string' && entry.company.trim() ? normalizeWhitespace(entry.company) : null,
          startDate: typeof entry.startDate === 'string' && entry.startDate.trim() ? normalizeWhitespace(entry.startDate) : null,
          endDate: typeof entry.endDate === 'string' && entry.endDate.trim() ? normalizeWhitespace(entry.endDate) : null,
          description: compactList(asStringArray(entry.description), 8),
        }))
        .filter(entry => entry.description.length > 0 || entry.role !== 'Experience')
    : [];

  const projects = Array.isArray(record.projects)
    ? record.projects
        .filter(isRecord)
        .map(project => ({
          name: typeof project.name === 'string' && project.name.trim() ? normalizeWhitespace(project.name) : 'Project',
          description: compactList(asStringArray(project.description), 6),
          link: typeof project.link === 'string' && project.link.trim() ? normalizeWhitespace(project.link) : null,
        }))
        .filter(project => project.description.length > 0 || project.name !== 'Project')
    : [];

  const seniority = seniorityValues.includes(String(record.seniority) as ResumeAnalysis['seniority'])
    ? (record.seniority as ResumeAnalysis['seniority'])
    : 'unknown';

  return {
    summary: typeof record.summary === 'string' ? normalizeWhitespace(record.summary) : '',
    skills: uniqueStrings(asStringArray(record.skills)),
    roles: uniqueStrings(asStringArray(record.roles)),
    seniority,
    experience_years: numberOrNull(record.experience_years),
    education: typeof record.education === 'string' && record.education.trim() ? normalizeWhitespace(record.education) : null,
    certifications: uniqueStrings(asStringArray(record.certifications)),
    keywords: uniqueStrings(asStringArray(record.keywords)),
    achievements: compactList(asStringArray(record.achievements), 15),
    experienceDescriptions,
    projects,
  };
}

export function normalizeJobAnalysis(value: unknown): JobAnalysis {
  const record = isRecord(value) ? value : {};
  const seniority = seniorityValues.includes(String(record.seniority) as JobAnalysis['seniority'])
    ? (record.seniority as JobAnalysis['seniority'])
    : 'unknown';
  const tone = jobToneValues.includes(String(record.tone) as JobAnalysis['tone'])
    ? (record.tone as JobAnalysis['tone'])
    : 'general';

  const mustHave = uniqueStrings(asStringArray(record.must_have_skills));
  const preferred = uniqueStrings(asStringArray(record.preferred_skills));
  const skills = uniqueStrings([...mustHave, ...preferred, ...asStringArray(record.skills), ...asStringArray(record.tools)]);

  return {
    title: typeof record.title === 'string' && record.title.trim() ? normalizeWhitespace(record.title) : 'Untitled Job',
    summary: typeof record.summary === 'string' ? normalizeWhitespace(record.summary) : '',
    skills,
    must_have_skills: mustHave.length ? mustHave : skills,
    preferred_skills: preferred,
    responsibilities: compactList(asStringArray(record.responsibilities), 20),
    keywords: uniqueStrings(asStringArray(record.keywords)),
    tools: uniqueStrings(asStringArray(record.tools)),
    seniority,
    experience_years: numberOrNull(record.experience_years),
    education: typeof record.education === 'string' && record.education.trim() ? normalizeWhitespace(record.education) : null,
    tone,
    domain: typeof record.domain === 'string' && record.domain.trim() ? normalizeWhitespace(record.domain) : null,
  };
}

export function formatExperienceEntries(experience: ExperienceEntry[]): string[] {
  return experience.map(exp => {
    const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' – ');
    const heading = [exp.role, exp.company ? `at ${exp.company}` : '', dates ? `(${dates})` : '']
      .filter(Boolean)
      .join(' ');
    const bullets = exp.description.map(item => `• ${item}`).join('\n');
    return [heading, bullets].filter(Boolean).join('\n');
  });
}

export function formatProjectEntries(projects: ProjectEntry[]): string[] {
  return projects.map(project => {
    const bullets = project.description.map(item => `• ${item}`).join('\n');
    return [project.name, bullets, project.link ? `Link: ${project.link}` : ''].filter(Boolean).join('\n');
  });
}

export function buildResumeSignalText(resume: ResumeAnalysis): string {
  return truncateText(
    [
      resume.summary,
      resume.roles.join(', '),
      resume.skills.join(', '),
      resume.certifications.join(', '),
      resume.keywords.join(', '),
      resume.achievements.join('\n'),
      ...formatExperienceEntries(resume.experienceDescriptions),
      ...formatProjectEntries(resume.projects),
      resume.education || '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    LIMITS.maxChatContextChars
  );
}

export function buildJobSignalText(job: JobAnalysis): string {
  return truncateText(
    [
      job.title,
      job.summary,
      `Must-have skills: ${job.must_have_skills.join(', ')}`,
      `Preferred skills: ${job.preferred_skills.join(', ')}`,
      `Tools: ${job.tools.join(', ')}`,
      `Keywords: ${job.keywords.join(', ')}`,
      `Responsibilities:\n${job.responsibilities.map(item => `• ${item}`).join('\n')}`,
      job.education ? `Education: ${job.education}` : '',
      job.domain ? `Domain: ${job.domain}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    LIMITS.maxChatContextChars
  );
}

export function buildResumeChatContext(
  resumeAnalysis: unknown,
  jobAnalysis: unknown,
  gap: ResumeGapRow
): ResumeChatContext {
  const resume = normalizeResumeAnalysis(resumeAnalysis);
  const job = normalizeJobAnalysis(jobAnalysis);

  return {
    resumeSummary: resume.summary,
    resumeSkills: resume.skills,
    resumeExperience: formatExperienceEntries(resume.experienceDescriptions),
    resumeProjects: formatProjectEntries(resume.projects),
    resumeEducation: resume.education,
    resumeCertifications: resume.certifications,
    resumeKeywords: resume.keywords,
    jobTitle: job.title,
    jobSummary: job.summary,
    jobSkills: job.skills,
    jobMustHaveSkills: job.must_have_skills,
    jobPreferredSkills: job.preferred_skills,
    jobResponsibilities: job.responsibilities,
    jobTone: job.tone,
    missingSkills: Array.isArray(gap.missing_skills) ? gap.missing_skills : [],
    fitScore: typeof gap.fit_score === 'number' ? gap.fit_score : 0,
  };
}

function wordSet(value: string): Set<string> {
  return new Set(
    canonicalSkill(value)
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length > 1)
  );
}

function skillMatches(candidateSkill: string, targetSkill: string): boolean {
  const candidate = canonicalSkill(candidateSkill);
  const target = canonicalSkill(targetSkill);
  if (!candidate || !target) return false;
  if (candidate === target) return true;

  const candidateTokens = wordSet(candidate);
  const targetTokens = wordSet(target);
  if (targetTokens.size === 0 || candidateTokens.size === 0) return false;

  let shared = 0;
  for (const token of targetTokens) {
    if (candidateTokens.has(token)) shared += 1;
  }

  return shared / targetTokens.size >= 0.75;
}

export function skillOverlap(
  resumeSkills: string[],
  jobSkills: string[],
  supportingText = ''
): { matchedSkills: string[]; missingSkills: string[]; score: number } {
  const normalizedResumeSkills = uniqueStrings(resumeSkills);
  const supporting = canonicalSkill(supportingText);
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const uniqueJobSkills = uniqueStrings(jobSkills);

  for (const skill of uniqueJobSkills) {
    const target = canonicalSkill(skill);
    const matchedBySkill = normalizedResumeSkills.some(candidate => skillMatches(candidate, skill));
    const matchedByContext = target.length > 2 && new RegExp(`(^|\\b)${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`, 'i').test(supporting);

    if (matchedBySkill || matchedByContext) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  return {
    matchedSkills,
    missingSkills,
    score: uniqueJobSkills.length ? matchedSkills.length / uniqueJobSkills.length : 0,
  };
}
