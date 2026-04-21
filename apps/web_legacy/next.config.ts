import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bun:sqlite"],
  transpilePackages: ["@surety/db", "@surety/api"],
  // Allow E2E tests to use a separate build directory
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Allow cross-origin requests in development (e.g., from reverse proxies)
  // Customize ALLOWED_DEV_ORIGINS env var for your domain setup
  allowedDevOrigins: (() => {
    const envOrigins = process.env.ALLOWED_DEV_ORIGINS;
    return envOrigins
      ? envOrigins.split(",").map((o) => o.trim())
      : ["localhost"];
  })(),
  // Allow loading images from external domains (e.g., Google avatars)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
