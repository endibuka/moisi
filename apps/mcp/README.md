# Moisi MCP

Model Context Protocol server exposing Moisi's stem-separation tools over HTTP
with OAuth 2.1 (PKCE + Dynamic Client Registration). Deploys to Cloud Run.

## Tools

| Tool | What it does |
| --- | --- |
| `start_separation` | Submit an audio URL for stem separation. Returns `job_id`. |
| `list_jobs` | Recent jobs for the user, optionally filtered by `status`. |
| `get_job_status` | One job by id — status, stems map, error, etc. |
| `get_stem_url` | Signed download URL for one stem of a completed job. |

## Architecture

```
MCP client (Claude, Cursor, …)
        │
        │ 1. fetch /.well-known/oauth-protected-resource
        │ 2. fetch /.well-known/oauth-authorization-server
        │ 3. POST   /oauth/register   (Dynamic Client Registration)
        │ 4. GET    /oauth/authorize  (PKCE + Supabase session check)
        │             → /oauth/login if not signed in
        │             → /oauth/consent → redirects back with ?code=…
        │ 5. POST   /oauth/token      (code + code_verifier → JWT)
        │ 6. POST   /mcp              (Authorization: Bearer <jwt>)
        ▼
Moisi MCP (Cloud Run / localhost:3002)
        │
        ├─ Supabase (service-role) — reads/writes separation_jobs, oauth_clients, oauth_codes
        ├─ Supabase Storage         — signs URLs for stems
        └─ RunPod /v2/<endpoint>/run — kicks off new separations
```

**Self-contained auth.** The MCP server has its own `/oauth/login` so the
OAuth dance doesn't depend on cookies being shared between subdomains —
which matters because `.run.app` (and `.vercel.app`, `.appspot.com`, etc.)
are on the Public Suffix List and can't share cookies across subdomains.

**OAuth state is persisted in Supabase** (tables
`mcp_oauth_clients` and `mcp_oauth_codes`) so the server works under any
horizontal scaling shape — multiple Cloud Run instances will all see the
same DCR clients and authorization codes.

## Setup

### 1. Install

```bash
npm --prefix apps/mcp install
```

### 2. Apply the OAuth migration

The migration adds two tables for OAuth state. Run it once against your
Supabase project:

```bash
# Either via the Supabase CLI:
supabase db push

# Or paste apps/app/supabase/migrations/0004_mcp_oauth.sql into the
# Supabase dashboard SQL editor and Run.
```

### 3. Env vars (`apps/mcp/.env.local`)

```bash
# Public identity of this MCP server (must match the deployed URL)
MCP_ISSUER=http://localhost:3002

# HS256 signing secret for access tokens — required in production.
MCP_JWT_SECRET=

# Supabase project (same one the main app uses)
SUPABASE_URL=https://yuzvjujxgwvjbyqydgtx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# RunPod (for start_separation)
RUNPOD_ENDPOINT_ID=7ta8w0icsvxnld
RUNPOD_API_KEY=rpa_...
```

### 4. Run

From the repo root:

```bash
npm run dev          # app + web + mcp + inngest
npm run dev:mcp      # just the MCP server
```

The MCP server lands at <http://localhost:3002>.

## Connecting an MCP client

```bash
claude mcp add moisi --transport http --url http://localhost:3002/mcp
```

Walk through the login + consent screen once and the four tools appear in
the client. Tokens are valid for 1 hour.

## Deploying to Google Cloud Run

```bash
# From repo root:
gcloud run deploy moisi-mcp \
  --source apps/mcp \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars MCP_ISSUER=https://<your-mcp-url> \
  --set-env-vars MCP_JWT_SECRET=$(openssl rand -hex 64) \
  --set-env-vars SUPABASE_URL=... \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=...:latest \
  --set-secrets NEXT_PUBLIC_SUPABASE_ANON_KEY=...:latest \
  --set-env-vars RUNPOD_ENDPOINT_ID=... \
  --set-secrets RUNPOD_API_KEY=...:latest
```

`MCP_ISSUER` **must** equal the public URL Cloud Run assigns (or your custom
domain) — the OAuth metadata endpoints emit it verbatim. After the first
deploy, copy the `*.run.app` URL into `MCP_ISSUER` and redeploy.

Cloud Run runs the Next.js standalone build by default. No Dockerfile is
required; the buildpack handles it. If you prefer an explicit Dockerfile,
the official Next.js standalone pattern works as-is.

## Notes

- **DCR is open** — anyone can register a client. For a multi-tenant
  deployment, gate `/oauth/register` with a registration token.
- **No refresh tokens** — clients re-auth every hour. Add a refresh grant
  in `/oauth/token` whenever you want longer-lived sessions.
- **Code GC** is opportunistic — `createCode` deletes expired / used rows
  on each call. For larger volume add a cron sweep.
