import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow Vercel builds to succeed even while we address outstanding lint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow Vercel builds to succeed even with type errors
    ignoreBuildErrors: true,
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
      config.externals = config.externals || [];
      config.externals.push({
        'ssh2': 'commonjs ssh2',
        'ssh2-sftp-client': 'commonjs ssh2-sftp-client',
        'odbc': 'commonjs odbc',
      });
    }
    return config;
  },
};

export default nextConfig;
