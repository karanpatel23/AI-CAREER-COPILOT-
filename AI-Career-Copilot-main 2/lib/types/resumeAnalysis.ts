/**
 * Structured resume analysis returned by the AI extraction step.
 * Keep this shape stable because it is stored as JSONB in Supabase.
 */
export type ResumeAnalysis = {
  /** Candidate positioning summary extracted from the resume, not invented. */
  summary: string;

  /** Technical, domain, business, and transferable skills explicitly supported by the resume. */
  skills: string[];

  /** Job titles or functional roles held by the candidate. */
  roles: string[];

  /** Inferred seniority based on titles, scope, and years of experience. */
  seniority: 'junior' | 'mid' | 'senior' | 'lead' | 'unknown';

  /** Estimated total years of professional experience. */
  experience_years: number | null;

  /** Education details explicitly present on the resume. */
  education: string | null;

  /** Certifications, licenses, or credentials explicitly present on the resume. */
  certifications: string[];

  /** High-signal keywords found in the resume that can support matching and tailoring. */
  keywords: string[];

  /** Notable achievements or measurable outcomes already present in the resume. */
  achievements: string[];

  /** Detailed work experiences broken down by role and company. */
  experienceDescriptions: {
    role: string;
    company?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    /** Bullet points describing responsibilities and achievements. */
    description: string[];
  }[];

  /** Projects section highlighting relevant work. */
  projects: {
    name: string;
    /** Bullet points describing project details. */
    description: string[];
    link?: string | null;
  }[];
};
