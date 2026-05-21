-- Muse chat persistence. Two tables:
--   muse_conversations — one row per chat session (id matches the URL ?c=).
--   muse_messages       — append-only message log per conversation.
--
-- user_id is denormalized onto muse_messages so RLS can be a single-table
-- equality check (auth.uid() = user_id) instead of a join via the conversation.

create table public.muse_conversations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.muse_conversations enable row level security;

create policy "select own muse conversations" on public.muse_conversations
  for select using (auth.uid() = user_id);
create policy "insert own muse conversations" on public.muse_conversations
  for insert with check (auth.uid() = user_id);
create policy "update own muse conversations" on public.muse_conversations
  for update using (auth.uid() = user_id);
create policy "delete own muse conversations" on public.muse_conversations
  for delete using (auth.uid() = user_id);

create index muse_conversations_user_updated_idx
  on public.muse_conversations (user_id, updated_at desc);

create table public.muse_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.muse_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'muse')),
  content text not null default '',
  attachment_path text,
  attachment_name text,
  tool_events jsonb,
  created_at timestamptz not null default now()
);

alter table public.muse_messages enable row level security;

-- Messages are immutable once written; deleting the conversation cascades.
create policy "select own muse messages" on public.muse_messages
  for select using (auth.uid() = user_id);
create policy "insert own muse messages" on public.muse_messages
  for insert with check (auth.uid() = user_id);

create index muse_messages_conv_created_idx
  on public.muse_messages (conversation_id, created_at asc);
