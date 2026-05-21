# syntax=docker/dockerfile:1.6
#
# Cloud Run image for the Moisi dashboard (apps/app). Three-stage build:
#   deps   — install npm packages with a cacheable layer
#   builder — run `next build` against the standalone output
#   runner  — tiny final image (~150 MB) that boots `node server.js`
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so
# they're passed in as build args via cloudbuild.yaml (not just runtime env).

FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app

# Build-time NEXT_PUBLIC values — these get baked into the JS bundles served
# to the browser. Runtime env is set separately in `gcloud run deploy`.
# Supabase renamed `anon` → `publishable` in their newer API console; this
# app reads PUBLISHABLE_KEY in lib/supabase/{client,server,proxy}.ts.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Cloud Run sends traffic to $PORT (defaults to 8080). Bind to all interfaces
# so it's reachable from the container's external network.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Run as a non-root user to satisfy Cloud Run's security baseline.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone output bundles its own minimal node_modules at .next/standalone.
# `public/` and the static chunks live outside that bundle and must be copied
# alongside it so the server can serve assets and hashed JS/CSS.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
