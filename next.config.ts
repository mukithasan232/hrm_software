const nextConfig = {
  reactStrictMode: true,

  // Force all pages/routes to be dynamic — prevents Next.js from trying
  // to statically analyze API routes that import Prisma/DB at build time.
  // Each API route also has `export const dynamic = 'force-dynamic'` for clarity.
  // output: 'standalone', // Removed to fix Coolify 'next start' warning

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

  // Bypass TypeScript errors during production builds.
  // The dedicated "Type Check & Lint" CI job handles this strictly — no need to block the build here.
  // Note: 'eslint' key is removed — Next.js 16 no longer supports it in next.config.ts.
  typescript: {
    ignoreBuildErrors: true,
  },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

export default nextConfig;
