FROM node:22-alpine AS base

# Install OpenSSL (required by Prisma) and curl (for healthchecks)
RUN apk add --no-cache openssl

# Enable pnpm via corepack
RUN corepack enable pnpm

WORKDIR /app

# ── Step 1: Install dependencies ─────────────────────────────────────────────
# Copy BOTH lockfile and workspace config so pnpm can resolve allowBuilds
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Step 2: Copy source code ──────────────────────────────────────────────────
COPY . .

# Make the entrypoint script executable
RUN chmod +x entrypoint.sh

# ── Step 3: Build ─────────────────────────────────────────────────────────────
# DATABASE_URL is needed by Prisma generate at build time
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client and build Next.js
RUN pnpm exec prisma generate && pnpm exec next build

# ── Step 4: Runtime environment ───────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# ── Step 5: Start ─────────────────────────────────────────────────────────────
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]