-- Stem-separation jobs. One row per uploaded song.
create table public.separation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  original_name text not null,
  input_path text not null,          -- path in the `uploads` storage bucket
  stems jsonb,                        -- { vocals, drums, bass, other } paths in `stems` bucket
  runpod_id text,                     -- RunPod serverless job id
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.separation_jobs enable row level security;

-- Users may only see / create / touch their own jobs.
-- The webhook route updates rows with the service-role key, which bypasses RLS.
create policy "select own jobs" on public.separation_jobs
  for select using (auth.uid() = user_id);
create policy "insert own jobs" on public.separation_jobs
  for insert with check (auth.uid() = user_id);
create policy "update own jobs" on public.separation_jobs
  for update using (auth.uid() = user_id);

create index separation_jobs_user_created_idx
  on public.separation_jobs (user_id, created_at desc);

-- Let the app subscribe to live status changes.
alter publication supabase_realtime add table public.separation_jobs;
