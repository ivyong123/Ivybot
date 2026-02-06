import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable server actions
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Enable verbose logging in production
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  // Ignore TypeScript errors in production build for faster iteration
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
