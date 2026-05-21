-- Capture audio duration at upload time so the library table can show it
-- without having to fetch every original audio file in the browser.
alter table public.separation_jobs
  add column if not exists duration_seconds numeric;
