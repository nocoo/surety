import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bun:sqlite"],
  // Allow E2E tests to use a separate build directory
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Allow cross-origin requests in development (e.g., from reverse proxies)
  allowedDevOrigins: [
    "localhost",
    "*.hexly.ai",
    "*.dev.hexly.ai",
  ],
};

export default nextConfig;
