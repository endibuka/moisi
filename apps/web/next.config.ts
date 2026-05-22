import type { NextConfig } from "next";

// Vercel manages its own build output and chokes on standalone output +
// outputFileTracingRoot (ENOENT routes-manifest-deterministic.json). Only
// apply the Cloud Run-specific settings when NOT building on Vercel.
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Minimal Node server output for Cloud Run — see apps/app/next.config.ts
  // for the longer rationale. Skipped on Vercel.
  ...(isVercel
    ? {}
    : { output: "standalone", outputFileTracingRoot: __dirname }),
  // Pin the workspace root to this app so Turbopack only watches and
  // resolves apps/web — not the whole monorepo (incl. apps/app/node_modules).
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Persist Turbopack's work to .next between dev sessions for faster boots.
    turbopackFileSystemCacheForDev: true,
  },
  images: {
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
