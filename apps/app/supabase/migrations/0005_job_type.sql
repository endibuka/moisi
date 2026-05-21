-- Different stem-extraction modes share the same job pipeline. job_type lets
-- the worker branch on what to run (full 7-stem demucs+roformer pipeline vs
-- the lightweight 2-stem vocal/instrumental split that powers the Vocal
-- Isolator and Karaoke Maker tools).
alter table public.separation_jobs
  add column if not exists job_type text not null default 'separation'
    check (job_type in ('separation', 'vocal_isolation'));
