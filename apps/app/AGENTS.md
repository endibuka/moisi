<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Styling

Before building or editing any UI, read [STYLING.md](./STYLING.md) — it defines
the project's colors, typography, layout, component conventions and effects.
Keep all new UI consistent with it.

# Auth

This app uses **Supabase** for authentication via `@supabase/ssr`. Session
refresh and route protection run in `proxy.ts` (Next.js 16 renamed
`middleware` → `proxy`). Supabase clients live in `lib/supabase/`.
