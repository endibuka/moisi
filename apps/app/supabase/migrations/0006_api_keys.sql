-- Personal API keys for the public /api/v1/* surface.
--
-- Storage model:
--   - `hashed_key` = sha256(plaintext) — fast O(1) lookup, fine since
--     plaintext is high-entropy (32 random bytes hex).
--   - `prefix`     = first visible chars of the key, displayed in the UI.
--   - `last_chars` = last 4 chars of the plaintext, for Stripe-style display
--     (`mk_live_••••a3f1`). User identifies their key without ever seeing
--     the full secret again.
--   - `revoked_at` is soft-delete; revoked keys stay around for audit.
--   - `last_used_at` is bumped by the auth middleware on each request.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  hashed_key text not null unique,
  prefix text not null,
  last_chars text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.api_keys enable row level security;

-- Users can read / create / revoke their own keys.
-- The auth middleware uses the service-role key (bypasses RLS) to look up by
-- hash without leaking which user_id owns which row.
create policy "select own api keys" on public.api_keys
  for select using (auth.uid() = user_id);
create policy "insert own api keys" on public.api_keys
  for insert with check (auth.uid() = user_id);
create policy "update own api keys" on public.api_keys
  for update using (auth.uid() = user_id);

create index api_keys_hashed_key_idx on public.api_keys (hashed_key)
  where revoked_at is null;
create index api_keys_user_created_idx
  on public.api_keys (user_id, created_at desc);
