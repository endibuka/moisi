import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
