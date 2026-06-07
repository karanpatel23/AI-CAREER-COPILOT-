/**
 * Structured job analysis returned by the AI extraction step.
 * Stored as JSONB in Supabase and used by gap analysis, matching, and tailoring.
 */
export type JobAnalysis = {
  title: string;
  summary: string;
  skills: string[];
  must_have_skills: string[];
  preferred_skills: string[];
  responsibilities: string[];
  keywords: string[];
  tools: string[];
  seniority: 'junior' | 'mid' | 'senior' | 'lead' | 'unknown';
  experience_years: number | null;
  education: string | null;
  tone: 'technical' | 'business' | 'leadership' | 'customer_facing' | 'general';
  domain: string | null;
};
