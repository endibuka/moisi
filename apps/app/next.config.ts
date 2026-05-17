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
  },
};

export default nextConfig;
