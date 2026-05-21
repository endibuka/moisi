-- OAuth state for the MCP server (apps/mcp). Lives in the same Supabase
-- project as the main app so we share the service-role key without needing a
-- second DB. RLS is irrelevant here — only the MCP server's service-role
-- client ever touches these.

create table public.mcp_oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris text[] not null,
  registered_at timestamptz not null default now()
);

create table public.mcp_oauth_codes (
  code text primary key,
  client_id text not null references public.mcp_oauth_clients (client_id) on delete cascade,
  redirect_uri text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_challenge text not null,
  code_challenge_method text not null default 'S256'
    check (code_challenge_method = 'S256'),
  scope text not null default 'mcp:read mcp:write',
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- Codes are short-lived; an index on (used, expires_at) makes the GC sweep cheap.
create index mcp_oauth_codes_gc_idx
  on public.mcp_oauth_codes (used, expires_at);

-- Neither table is exposed via PostgREST to anonymous clients.
alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
-- No policies = no access for anon/auth users; only the service role can read/write.
