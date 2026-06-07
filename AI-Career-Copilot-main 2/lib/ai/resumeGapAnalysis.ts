/**
 * Resume-Job Gap Analysis Module
 *
 * Computes relevance using job-signal weighting, not only shallow keyword overlap.
 */

import type { JobAnalysis } from '../types/jobAnalysis';
import type { ResumeAnalysis } from '../types/resumeAnalysis';
import { buildResumeSignalText, normalizeJobAnalysis, normalizeResumeAnalysis, skillOverlap, uniqueStrings } from '../resumeFormatters';

const seniorityRank: Record<string, number> = {
  unknown: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function experienceScore(resumeYears: number | null, jobYears: number | null): number {
  if (jobYears === null || jobYears <= 0) return 1;
  if (resumeYears === null) return 0.55;
  if (resumeYears >= jobYears) return 1;
  return clampScore(resumeYears / jobYears);
}

function seniorityScore(resumeSeniority: string, jobSeniority: string): number {
  const resumeRank = seniorityRank[resumeSeniority] ?? 0;
  const jobRank = seniorityRank[jobSeniority] ?? 0;

  if (!jobRank || !resumeRank) return 0.75;
  if (resumeRank >= jobRank) return 1;
  if (jobRank - resumeRank === 1) return 0.65;
  return 0.35;
}

export function analyzeResumeGaps(rawResume: ResumeAnalysis | unknown, rawJob: JobAnalysis | unknown) {
  const resume = normalizeResumeAnalysis(rawResume);
  const job = normalizeJobAnalysis(rawJob);
  const resumeSignalText = buildResumeSignalText(resume);

  const mustHaveSkills = uniqueStrings(job.must_have_skills.length ? job.must_have_skills : job.skills);
  const preferredSkills = uniqueStrings(job.preferred_skills);
  const keywordSignals = uniqueStrings([...job.keywords, ...job.tools]).filter(
    skill => !mustHaveSkills.some(required => required.toLowerCase() === skill.toLowerCase())
  );

  const mustHaveOverlap = skillOverlap(resume.skills, mustHaveSkills, resumeSignalText);
  const preferredOverlap = skillOverlap(resume.skills, preferredSkills, resumeSignalText);
  const keywordOverlap = skillOverlap(resume.skills, keywordSignals, resumeSignalText);

  const resumeYears = resume.experience_years;
  const jobYears = job.experience_years;
  const yearsScore = experienceScore(resumeYears, jobYears);
  const levelScore = seniorityScore(resume.seniority, job.seniority);

  const experienceGap =
    resumeYears !== null && jobYears !== null && resumeYears < jobYears
      ? Number((jobYears - resumeYears).toFixed(1))
      : 0;

  const seniorityMismatch =
    resume.seniority !== 'unknown' &&
    job.seniority !== 'unknown' &&
    (seniorityRank[resume.seniority] ?? 0) < (seniorityRank[job.seniority] ?? 0)
      ? { resume: resume.seniority, job: job.seniority }
      : null;

  const skillScore = clampScore(
    mustHaveOverlap.score * 0.72 +
      preferredOverlap.score * 0.18 +
      keywordOverlap.score * 0.1
  );

  const fitScore = clampScore(skillScore * 0.62 + yearsScore * 0.23 + levelScore * 0.15);
  const missingSkills = uniqueStrings([...mustHaveOverlap.missingSkills, ...preferredOverlap.missingSkills]);
  const matchedSkills = uniqueStrings([
    ...mustHaveOverlap.matchedSkills,
    ...preferredOverlap.matchedSkills,
    ...keywordOverlap.matchedSkills,
  ]);

  const missingExperienceOrProjects: string[] = [];
  if (mustHaveOverlap.missingSkills.length) {
    missingExperienceOrProjects.push('Add or emphasize truthful projects, work bullets, coursework, or certifications that prove the missing must-have skills.');
  }
  if (experienceGap > 0) {
    missingExperienceOrProjects.push(`The resume appears about ${experienceGap} year(s) below the stated experience requirement; emphasize scope, ownership, and relevant internships/projects if truthful.`);
  }
  if (seniorityMismatch) {
    missingExperienceOrProjects.push('The target role appears more senior than the resume positioning; strengthen leadership, ownership, and measurable impact where already supported.');
  }

  return {
    matchedSkills,
    missingSkills,
    mustHaveMatchedSkills: mustHaveOverlap.matchedSkills,
    mustHaveMissingSkills: mustHaveOverlap.missingSkills,
    preferredMatchedSkills: preferredOverlap.matchedSkills,
    preferredMissingSkills: preferredOverlap.missingSkills,
    experienceGap,
    seniorityMismatch,
    missingExperienceOrProjects,
    skillScore,
    fitScore,
    componentScores: {
      mustHaveSkillScore: clampScore(mustHaveOverlap.score),
      preferredSkillScore: clampScore(preferredOverlap.score),
      keywordScore: clampScore(keywordOverlap.score),
      skillScore,
      experienceScore: yearsScore,
      seniorityScore: levelScore,
    },
  };
}
