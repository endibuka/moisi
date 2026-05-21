-- Two new optional columns shared by the new tools:
--   cover_art_path  — Supabase Storage path for AI-generated cover art
--                     (Cover Art tool); null for jobs that haven't been
--                     given a cover yet. Lives under the `stems` bucket.
--   prompt          — user-supplied generation prompt; populated by the
--                     Music Generator tool (job_type='music_generation').

alter table public.separation_jobs
  add column if not exists cover_art_path text,
  add column if not exists prompt text;

-- Expand job_type to include music generation. Drop the old check and
-- re-add it with the new option.
alter table public.separation_jobs
  drop constraint if exists separation_jobs_job_type_check;

alter table public.separation_jobs
  add constraint separation_jobs_job_type_check
    check (job_type in ('separation', 'vocal_isolation', 'music_generation'));
