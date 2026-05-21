import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app so Turbopack only watches and
  // resolves apps/app — not the whole monorepo (incl. apps/web/node_modules).
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Persist Turbopack's work to .next between dev sessions for faster boots.
    turbopackFileSystemCacheForDev: true,
    // Enable the browser View Transitions API for App Router navigations —
    // gives us a free crossfade between routes (e.g. switching chats from the
    // sidebar) with no JS-driven animation work.
    viewTransition: true,
  },
  // ADK + its OpenTelemetry/GCP/MikroORM/MCP deps don't bundle cleanly through
  // Next's server compilation; keep them as require()-from-node_modules.
  serverExternalPackages: [
    "@google/adk",
    "@google/genai",
    "@google-cloud/storage",
    "@mikro-orm/core",
    "@mikro-orm/reflection",
    "@modelcontextprotocol/sdk",
    "@opentelemetry/api",
    "@opentelemetry/sdk-trace-node",
    "winston",
  ],
  // Cloudflare tunnel host that proxies to this dev server (used so RunPod
  // can reach the webhook locally). Required for HMR cross-origin requests.
  allowedDevOrigins: ["web.endibuka-webhook.work"],
};

export default nextConfig;
