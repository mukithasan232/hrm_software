import type { NextConfig } from "next";

const nextConfig = {
  reactStrictMode: true,

  // Tell Next.js/Turbopack NOT to bundle these native Node packages —
  // they must be required at runtime from node_modules on the server.
  serverExternalPackages: [
    'mariadb',
    'zkteco-js',
    'node-zklib',
    '@prisma/adapter-mariadb',
    'socket.io',
    'bcryptjs',
    'jsonwebtoken',
    'node-cron',
    'ts-node',
  ],

  // Allow serving uploaded images from the public directory
  images: {
    remotePatterns: [],
    unoptimized: true, // Required for self-hosted / Hostinger (no Vercel image CDN)
  },

  // Bypass TypeScript & ESLint errors during production builds.
  // The dedicated "Type Check & Lint" CI job handles this strictly — no need to block the build here.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
} as any;

export default nextConfig;
