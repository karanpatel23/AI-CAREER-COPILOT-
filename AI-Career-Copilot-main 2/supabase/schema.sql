-- AI Career Copilot baseline Supabase schema
-- Run this in Supabase SQL editor before using the backend APIs.

create extension if not exists vector;

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  raw_text text not null,
  analysis jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  raw_text text not null,
  analysis jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resume_job_gaps (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  missing_skills text[] not null default '{}',
  experience_gap numeric not null default 0,
  seniority_mismatch jsonb,
  fit_score numeric not null default 0,
  suggestions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resume_job_gaps_unique unique (resume_id, job_id),
  constraint resume_job_gaps_fit_score_range check (fit_score >= 0 and fit_score <= 1)
);

create index if not exists resumes_user_id_idx on public.resumes(user_id);
create index if not exists jobs_title_idx on public.jobs(title);
create index if not exists resume_job_gaps_resume_id_idx on public.resume_job_gaps(resume_id);
create index if not exists resume_job_gaps_job_id_idx on public.resume_job_gaps(job_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists resumes_set_updated_at on public.resumes;
create trigger resumes_set_updated_at
before update on public.resumes
for each row execute function public.set_updated_at();

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

drop trigger if exists resume_job_gaps_set_updated_at on public.resume_job_gaps;
create trigger resume_job_gaps_set_updated_at
before update on public.resume_job_gaps
for each row execute function public.set_updated_at();
