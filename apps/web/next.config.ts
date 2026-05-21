import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal Node server output for Cloud Run — see apps/app/next.config.ts
  // for the longer rationale.
  output: "standalone",
  // Pin the workspace root to this app so Turbopack only watches and
  // resolves apps/web — not the whole monorepo (incl. apps/app/node_modules).
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
  experimental: {
    // Persist Turbopack's work to .next between dev sessions for faster boots.
    turbopackFileSystemCacheForDev: true,
  },
  images: {
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
