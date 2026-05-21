import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal Node server output for Cloud Run — see apps/app/next.config.ts
  // for the longer rationale.
  output: "standalone",
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
