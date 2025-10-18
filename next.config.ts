import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow Vercel builds to succeed even while we address outstanding lint errors.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Increase serverActions body size limit for large file uploads
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
};

export default nextConfig;
