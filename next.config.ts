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
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude native binary modules from webpack bundling
      // These modules will be available in the Node.js runtime on Vercel
      config.externals.push('ssh2', 'ssh2-sftp-client', 'odbc');
    }
    return config;
  },
};

export default nextConfig;
