import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
