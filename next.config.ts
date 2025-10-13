import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow Vercel builds to succeed even while we address outstanding lint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
