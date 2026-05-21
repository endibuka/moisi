# syntax=docker/dockerfile:1.6
#
# Cloud Run image for the Moisi MCP server (apps/mcp). Same three-stage
# pattern as apps/app/Dockerfile — see that file's header for the rationale.

FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app

# The MCP exposes OAuth + tool-call endpoints; the only NEXT_PUBLIC value
# referenced is the Supabase URL (used by the MCP-local login page that runs
# in the browser). Anon/publishable key is read at runtime, not build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# The MCP doesn't ship a public/ dir today; copy it conditionally so the
# build doesn't break if that ever changes.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
