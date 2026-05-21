-- YuE-based music generation. The existing `prompt` column now holds the
-- genre / style description; `lyrics` is the structured lyric text (with
-- [verse] / [chorus] markers). Both are nullable — null lyrics means an
-- instrumental.
alter table public.separation_jobs
  add column if not exists lyrics text;
