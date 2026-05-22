import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` ships a minimal Node server (.next/standalone/server.js)
  // plus only the deps actually imported at runtime — keeps the Docker image
  // around 150 MB instead of 1+ GB. Required for the Cloud Run deployment.
  output: "standalone",
  // Pin the workspace root to this app so Turbopack only watches and
  // resolves apps/app — not the whole monorepo (incl. apps/web/node_modules).
  turbopack: {
    root: __dirname,
  },
  // Standalone tracing follows the same root: include only this app, skip
  // sibling apps/* in the monorepo when computing the output bundle.
  outputFileTracingRoot: __dirname,
  experimental: {
    // Persist Turbopack's work to .next between dev sessions for faster boots.
    turbopackFileSystemCacheForDev: true,
    viewTransition: false,
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
