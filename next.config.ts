import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
